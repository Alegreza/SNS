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
- **Deploy**: Render.com via `render.yaml` (web service), custom domain `cksns.live` (name.com → Render, Cloudflare in front)

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

- **Spaces**: Class (per grade), Subject (per grade), Club (all grades)
- **Sections per space**: Announcements & Assignments / Questions / Anonymous & Vent
- **Access control**:
  - Students: grade-matched class/subject spaces + all clubs
  - Teachers: only spaces assigned via `user_spaces` (admin assigns in Admin > Space Assignment tab)
  - Admins: see all spaces and all posts
  - Teachers cannot post in Anonymous & Vent section
- **Verification**: manual (admin approves), student_id (photo upload), school_sso (placeholder)
- **Roles**: student / teacher / admin
- **Comments + Notifications**: comment on a post notifies the post author (polled every 15s)
- **Admin panel** (3 tabs):
  - Users: list/approve/reject users by verification status
  - Posts: view all posts with real author name + IP (including anonymous), delete posts
  - Space Assignment: assign/remove teachers to specific spaces
- **IP tracking**: every post and comment stores `author_ip` (X-Forwarded-For via Render proxy)
- **Anonymous reveal**: admin-only — real `author_name` + `author_ip` shown for anonymous posts/comments
- **Rate limiting**: 100 req / 15 min on `/api/*`
- **Structured logging**: pino — auth events, admin actions, errors

## Design

- Everytime (Korean university SNS) inspired style
- Red primary: `#e53935`
- Top sticky navbar (red background), left sidebar board list, dense post card list
- Post card row: section badge + title + [comment count] / excerpt / author · date
- Admin reveal badge: purple `🔍 realname · IP: x.x.x.x`
- Font: Noto Sans KR via Google Fonts CDN
- Mobile: sidebar stacks above content

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

---

## Starting a New Session

```
Read CLAUDE.md and start work on the next task.
Ask GPT for direction before implementing, and consult on key design decisions.
```

## Remaining Work (Not Yet Implemented)

- Verify Microsoft login end-to-end on production (never actually tested, unlike Google)
- No admin-facing endpoint to view uploaded student ID photos yet (files are stored, just not retrievable through the app)
- XSS prevention: DOMPurify to sanitize post/comment content
- CSP headers: `helmet.js`
- JWT → HttpOnly Cookie migration (currently localStorage)
- Dark mode
- CSS micro-interactions (transitions on hover, tab changes)
- Log retention policy (Render log rotation)
- README.md is stale (still describes SQLite, no mention of Supabase/cksns.live/Google OAuth)
