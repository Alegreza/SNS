# CKSNS — Project Context

**Project name**: CKSNS (Cranbrook School SNS). "Kobe" is a collaborator's name, not the project name.

School-only SNS for Cranbrook high school students (grades 9–12). Closed platform: users must be verified before posting.

## Language Rule

**All code, UI text, comments, and documentation must be in English.** No Korean anywhere in the codebase.

## Tech Stack

- **Frontend**: Vanilla JS (no build step, IIFE wrapper). Single file `src/app.js`. ES5-compatible for `file://` fallback.
- **Backend**: Node.js + Express, port 3000
- **Database**: PostgreSQL via `pg` pool. **Actually hosted on Supabase, not Render** — `render.yaml` still declares an unused Render-managed `cksns-db`; the real `DATABASE_URL` is set directly in Render's dashboard env vars, pointing at Supabase. Don't trust `render.yaml`'s `databases:` block as the source of truth.
- **Auth**: JWT (localStorage key: `cksns_token`), Google OAuth (live), Microsoft MSAL (Azure AD) with JWKS signature verification
- **Logging**: `pino` + `pino-http` (JSON structured logs on Render stdout)
- **Security**: `helmet` for CSP + security headers (see `server/index.js` for the exact allowlist); `server/sanitize.js` strips all HTML from post/comment content server-side before storage (isomorphic-dompurify) — this app has no rich-text support, so the policy is "strip everything," not "allow a safe subset"
- **Deploy**: Render.com via `render.yaml` (web service), custom domain `cksns.live` (name.com → Render, Cloudflare in front). **Free tier** — spins down after ~15 min idle, cold-starts on next request. The Postgres pool has a `connectionTimeoutMillis` so a slow/unreachable DB fails fast (10s) instead of hanging the whole server indefinitely, but the spin-down itself only goes away on a paid plan.

## Project Structure

```
01. Kobe/               ← folder name (Kobe = collaborator), project = CKSNS
├── index.html          # SPA entry point (Noto Sans KR via Google Fonts)
├── render.yaml         # Render: web service + PostgreSQL cksns-db
├── .env.example        # Full env checklist
├── src/
│   ├── app.js          # Entire frontend (state + UI + event handlers)
│   ├── styles.css      # Everytime-style: red accent, sidebar, dense cards
│   ├── api-config.js   # Sets window.API_BASE
│   ├── auth-config.js  # Google OAuth config
│   └── msal-config.js  # Microsoft MSAL config
└── server/
    ├── index.js        # Express: pino-http, trust proxy, IP middleware, rate limit
    ├── db.js           # PostgreSQL schema + migrations + seeding (async)
    ├── config.js       # Env-based config
    ├── middleware/
    │   ├── auth.js     # JWT Bearer + cookie auth
    │   └── adminAuth.js
    └── routes/
        ├── auth.js         # /api/auth/*
        ├── posts.js        # /api/spaces, /api/posts, /api/posts/feed
        ├── comments.js     # /api/posts/:id/comments
        ├── notifications.js
        └── admin.js        # /api/admin/* (users, posts, space-teacher assignment)
```

## DB Schema (PostgreSQL)

- `users` — id, email, username, name, password_hash, role, grade, verification_status, ...
- `user_providers` — OAuth provider links (google, microsoft, email)
- `user_spaces` — teacher→space assignment (students filtered by grade logic in routes)
- `spaces` — id(text), type(class|subject|club), name, grade
- `posts` — id, space_id, section, title, content, author_id, author_name, author_role, is_anonymous, **author_ip**, created_at
- `comments` — id, post_id, author_id, author_name, author_role, is_anonymous, content, **author_ip**, created_at
- `notifications` — id, user_id, type, post_id, actor_name, message, is_read, created_at
- `uploads` — student ID photos

## Core Features (Implemented)

- **Spaces**: Class (per grade), Subject (per grade), Club (all grades). Admins can create new boards ("+ Create board" in Admin > Space Assignment), with an optional fully custom list of categories per board (stored as JSON in `spaces.sections`; NULL = the 3 app defaults). `POST /api/posts`'s section validation checks against the specific space's actual sections, not a hardcoded list.
- **Sections per space**: Announcements & Assignments / Questions / Anonymous & Vent by default, or custom per board (see above)
- **Access control**:
  - Students: grade-matched class/subject spaces + all clubs
  - Teachers: only spaces assigned via `user_spaces` (admin assigns in Admin > Space Assignment tab)
  - Admins: see all spaces and all posts
  - Teachers cannot post in Anonymous & Vent section
- **Verification**: manual (admin approves), student_id (photo upload), school_sso (placeholder)
- **Roles**: student / teacher / admin
- **Comments + Notifications**: comment on a post notifies the post author (polled every 15s)
- **Admin panel** (3 tabs, both Users and Posts have a client-side search box):
  - Users: list/approve/reject users by verification status; edit role + grade inline (`PATCH /api/admin/users/:id`) — **note**: role/grade are baked into the user's JWT at login, so an edited user won't see the change take effect until they re-authenticate, even though the DB updates immediately
  - Posts: view all posts with real author name + IP (including anonymous), delete posts
  - Space Assignment: assign/remove teachers to specific spaces; "+ Create board" to add new boards with custom categories
- **IP tracking**: every post and comment stores `author_ip` (X-Forwarded-For via Render proxy)
- **Anonymous reveal**: admin-only — real `author_name` + `author_ip` shown for anonymous posts/comments
- **Rate limiting**: 100 req / 15 min on `/api/*`
- **Structured logging**: pino — auth events, admin actions, errors

## Design

- Everytime (Korean university SNS) inspired style
- Red primary: `#e53935` (default — see accent color picker below)
- Top sticky navbar (red background), left sidebar board list, dense post card list
- Post card row: section badge (color-coded per section) + title + [comment count] / excerpt / author · date; anonymous posts get distinct muted styling
- Admin reveal badge: purple `🔍 realname · IP: x.x.x.x`
- Font: Noto Sans KR via Google Fonts CDN
- Mobile: sidebar stacks above content
- **Dark mode**: follows system `prefers-color-scheme` by default; manual toggle in the navbar (🌙/☀️) and in Settings, persisted to `localStorage`. All CSS colors are custom properties (`src/styles.css` `:root`) — any new UI must use tokens, not literal hex, or it won't adapt to dark mode. Native form controls (`<button>`/`<input>`/`<select>`/`<textarea>`) don't inherit `color` from ancestors — always set it explicitly or text becomes invisible in dark mode.
- **Accent color picker**: Settings > Appearance lets users pick from 6 presets (red/blue/green/purple/orange/teal, each with light+dark variants), applied via inline `--color-primary`/`-hover`/`-light` overrides on `<html>`, persisted to `localStorage` (`cksns_accent`)
- **Settings tab** (was "Profile"): Account info + Appearance (theme toggle, accent picker)

## Coding Conventions

- Frontend: no ES modules, IIFE wrapper. `var`/`let`/`const` freely inside.
- DOM manipulation imperative. `el(tag, cls)` helper creates elements.
- State: `userState` + `appViewState` inside IIFE.
- API calls via `apiCall(path, options)` — attaches JWT `cksns_token` header automatically.
- Backend: async/await (`pg` pool). `query`, `queryOne`, `run` helpers in `db.js`.
- All routes use `auth` middleware. Admin routes additionally use `adminAuth`.
- JWT payload: `userId`, `id`, `email`, `role`, `grade`, `name`.
- Logging: use `req.log.info/error` (pino) in routes, not `console.*`.
- **No Korean text anywhere** — all UI strings, comments, variable names, docs must be English.

## Key Constraints

- No npm build step — frontend files served as-is by Express static middleware.
- DB: PostgreSQL on Supabase (see Tech Stack note above — not the `render.yaml`-declared `cksns-db`).
- Default admin: email `admin` — password already rotated off the `admin`/`admin` default in production (startup warning prints to Render logs if it's ever still default).
- Google OAuth Client ID is set in `src/auth-config.js` and must match Render's `GOOGLE_CLIENT_ID` env var exactly, and the origin must be registered in Google Cloud Console (Authorized JavaScript origins + redirect URIs) for `cksns.live`.
- Microsoft MSAL: JWKS signature verification implemented (`jwks-rsa`). Client ID is set but end-to-end login has not been verified on production yet.
- `author_ip` is PII — only expose to admin role, never to other users.
- **`role` at signup must stay restricted to `student`/`teacher`** (`SELF_SIGNUP_ROLES` in `server/routes/auth.js`, all three signup paths). The DB's own `CHECK` constraint allows `'admin'` as a value, so this app-layer allowlist is the only thing preventing self-registered admin accounts — never remove it or trust the DB constraint alone.
- `server/config.js` throws at boot if `NODE_ENV=production` and `JWT_SECRET` isn't set — this is intentional (a hardcoded fallback secret is committed in this public repo). `render.yaml` sets `NODE_ENV=production`, but that env var only auto-applies on services created via Render Blueprints — if `cksns` was created by manually connecting the repo, dashboard env vars are the actual source of truth, not `render.yaml`.
- CORS is locked to `https://cksns.live`, `https://www.cksns.live`, `http://localhost:3000` (`server/index.js`) — add new origins there explicitly, don't revert to reflecting all origins.

## Environment Variables (.env.example)

```
PORT=3000
DATABASE_URL=                   # Render Postgres internal URL
JWT_SECRET=                     # openssl rand -hex 32
JWT_EXPIRES_IN=30d
GOOGLE_CLIENT_ID=               # console.cloud.google.com
MICROSOFT_CLIENT_ID=            # portal.azure.com
UPLOAD_DIR=./data/uploads
```

## GPT Collaboration

- MCP server `openai-gpt` is registered (`~/.claude/settings.json` and `.mcp.json`)
- Use `ask_gpt` tool to get a second opinion from GPT
- **Before starting work**: ask GPT for design/architecture direction first
- **On significant decisions**: get GPT review before proceeding

---

## Development Roadmap

### ✅ Phase 1 — Auth Completion [Done]
- `server/routes/admin.js`: `GET /api/admin/users`, `PATCH /api/admin/users/:id/verify`
- Frontend Profile tab: verification status badge (pending / approved / rejected)
- Frontend Admin tab: pending user list + approve/reject buttons

### ✅ Phase 2 — Social Features [Done]
- `comments` table + `GET/POST /api/posts/:id/comments`
- `notifications` table + `GET /api/notifications`, `PATCH` read handling
- Frontend: post card comment toggle + comment form
- Frontend: Notifications tab with 15s polling

### ✅ Phase 3 — Security Hardening [Done]
- Microsoft token JWKS signature verification (`jwks-rsa`)
- `express-rate-limit`: 100 req/15 min on `/api/*`
- `.env.example` full env checklist
- Startup warning if admin default password is still in use (`bcrypt.compare`)

### ✅ Phase 4 — Production Readiness [Done]
- `render.yaml`: PostgreSQL service (`cksns-db`) + `DATABASE_URL` wired
- DB: SQLite → PostgreSQL migration (data persistence on Render)
- `trust proxy 1` + X-Forwarded-For IP extraction middleware
- pino + pino-http structured logging

### ✅ Phase 5 — Design, Logging, Security Deep Dive [Done]
- **Design**: Everytime-style (red accent, top navbar, sidebar, dense cards)
- **Space access control**: teachers filtered by `user_spaces` assignments / students by grade
- **IP tracking**: `author_ip` stored on posts and comments; admin-only access
- **Anonymous reveal**: admin sees real author + IP on anonymous posts/comments
- **Admin panel expansion**: Users tab / Posts tab (IP + delete) / Space Assignment tab
- **pino logging**: auth events, admin actions, errors — structured JSON

### ✅ Phase 6 — Google OAuth Live + Security Audit [Done, 2026-07-29]
- **Google Sign-In frontend**: GIS button on login/signup, ID token decode for prefill, new-user profile-completion flow — mirrors the existing Microsoft flow. Backend endpoint already existed; frontend never called it until now.
- **Domain live**: `cksns.live` connected and serving over HTTPS (Cloudflare in front of Render).
- **DB is Supabase**, not the `render.yaml`-declared Render Postgres — see Tech Stack/Key Constraints.
- **Critical fix**: closed a privilege-escalation hole — `role` was accepted verbatim from signup requests on all 3 auth paths, and the DB `CHECK` constraint permits `'admin'`, so anyone could self-register as admin with no verification. Now allowlisted to `student`/`teacher` at the app layer.
- **Critical fix**: production had been silently running on the hardcoded fallback `JWT_SECRET` committed in this repo (never actually set on Render). Real secret now set; server refuses to boot in production without one.
- **Hardening**: CORS restricted to known origins (was reflecting any origin with `credentials: true`); `verification_method` validation made consistent across `/signup`, `/google`, `/microsoft`.
- **Dependencies**: `npm audit fix` resolved the vulnerabilities in packages that process request data (express, body-parser, qs, path-to-regexp, ip-address). Remaining flagged vulns are in build-time-only tooling (`@mapbox/node-pre-gyp`'s tar/glob chain, used only to fetch bcrypt's prebuilt binary) or unreachable code paths (`uuid` via `gaxios`) — left alone, would require major-version bumps of `bcrypt`/`google-auth-library` for very low real-world benefit here.

### ✅ Phase 7 — Design Overhaul, Production Incident, Security Hardening [Done, 2026-07-29/30]
- **Design system**: expanded CSS tokens (semantic success/warning/error/admin/info/anon colors, motion durations/easing), dark mode via `prefers-color-scheme` + manual toggle (navbar + Settings), 6-preset accent color picker (Settings > Appearance)
- **Auth redesign**: two-panel login/signup layout, grouped OAuth with divider, consolidated the duplicate Google/Microsoft "complete profile" forms into one helper, inline validation errors replacing blocking `alert()`s
- **Feed polish**: sidebar active-space accent bar, color-coded section badges, distinct anonymous-post styling, sliding navbar tab underline, button press feedback, focus rings
- **Settings tab** (renamed from Profile): Account info + Appearance section
- **Admin**: search bars on Users/Posts tabs, inline role/grade editing per user, "+ Create board" with custom per-board categories (new `spaces.sections` DB column)
- **Production incident**: the live site went fully unresponsive (TLS completed, then hung indefinitely on every route) after the Render free-tier service hibernated and failed to cleanly reconnect to Supabase on wake. Root cause: the `pg` Pool had no `connectionTimeoutMillis`, so an unreachable DB hung the server forever instead of failing. Fixed with a 10s timeout — turns a silent indefinite hang into a fast, loggable crash + Render restart. The free-tier spin-down cycle itself is unchanged (would need a paid Render plan to eliminate); user opted to leave it as-is for now rather than pay or add a keep-alive workaround.
- **Security hardening**: server-side content sanitization (`server/sanitize.js`, strips all HTML from post/comment content via DOMPurify before storage) and CSP headers via `helmet` (see Tech Stack). Caught and fixed a real gap post-deploy: Google's Sign-In script loads its own stylesheet from `accounts.google.com`, which the initial CSP didn't allowlist.
- **Bug fixes found along the way**: notification timestamps were using Korean locale formatting (`toLocaleString("ko-KR", ...)`) instead of the app's standard `fmtDate()` — violated the English-only rule; `auth.js` used raw `console.error` in all 6 catch blocks instead of the project's `req.log.error` convention, so auth failures weren't in Render's structured logs; default active section after login/board-switch was hardcoded to `"Announcements & Assignments"` in 7 places, which breaks for boards with fully custom categories — replaced with `defaultSectionForSpace()`.

---

## Starting a New Session

```
Read CLAUDE.md and start work on the next task.
Ask GPT for direction before implementing, and consult on key design decisions.
```

## Remaining Work (Not Yet Implemented)

- Verify Microsoft login end-to-end on production (code reviewed and looks correct, but this Azure app registration is org-restricted — needs an actual Cranbrook Microsoft 365 account to complete a real test; never actually confirmed working, unlike Google)
- No admin-facing endpoint to view uploaded student ID photos yet (files are stored, just not retrievable through the app)
- JWT → HttpOnly Cookie migration (currently localStorage)
- Log retention policy (Render log rotation)
- Render free-tier spin-down causes cold-start delays / occasional slow first-loads after idle periods — the indefinite-hang failure mode is fixed (see Phase 7), but the underlying spin-down cycle needs a paid Render plan to fully remove. Left as-is for now per user's choice.
- Google Sign-In button renders in Korean (`Google 계정으로 로그인`) — that's Google's own GIS widget localizing based on browser locale, not our codebase, but could be pinned to English via `?hl=en` on the GIS script tag if it's ever worth fixing
