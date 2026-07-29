# CKSNS – Cranbrook School SNS

A closed, school-only SNS for high school (grades 9–12), live at [cksns.live](https://cksns.live). Sign up with **email** or **username**, plus **Google** or **Microsoft**. School verification: manual (contact admin) or student ID upload. Class/subject boards (per grade) and clubs, each with Announcements & Assignments / Questions / Anonymous & Vent sections — admins can also create boards with fully custom categories.

Everytime (Korean university SNS)-inspired design: dense list-style feed, red accent, light/dark mode with a manual toggle and a per-user accent color picker.

## Quick start (local)

```bash
npm run install:server
npm start
```

Open `http://localhost:3000`. Copy `server/.env.example` to `server/.env` first and fill in `DATABASE_URL` (a Postgres connection string — see below) and `JWT_SECRET`.

There is no default admin account seeded with a known password — the first admin must be created directly in the database (or by promoting an existing verified user's `role` column to `'admin'`).

## Database

**PostgreSQL, hosted on Supabase** — not the `render.yaml`-declared Render Postgres block, which is unused. `DATABASE_URL` is set directly in Render's dashboard env vars, pointing at the Supabase connection string. Local dev needs any reachable Postgres instance (Supabase, a local install, whatever) — the schema/migrations in `server/db.js` run automatically on boot.

## Deployment (Render)

Already deployed and connected to GitHub — pushing to `main` auto-deploys to [cksns.live](https://cksns.live).

- **Build command:** `npm run install:server`
- **Start command:** `npm start`
- Env vars (set in Render's dashboard, not `render.yaml`): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`

**Known limitation:** the Render web service is on the free tier, which spins down after ~15 minutes of inactivity and cold-starts on the next request. The Postgres pool has a 10s connection timeout so a slow/unreachable database now fails fast instead of hanging the whole server — but the underlying spin-down behavior itself only goes away on a paid Render plan.

## Config

| Variable | Description |
|---|---|
| `PORT` | Server port (default 3000) |
| `DATABASE_URL` | Postgres connection string (required) |
| `JWT_SECRET` | Secret for JWT (required in production — server refuses to boot without one) |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional — must match `src/auth-config.js`) |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth (optional — must match `src/msal-config.js`) |
| `ADMIN_EMAIL` | Contact email shown to new users for manual verification |

## Security

- All post/comment content is sanitized server-side (`server/sanitize.js`, strips all HTML — this app has no rich-text support, so anything surviving would just show as literal tag text)
- CSP headers via `helmet` (see `server/index.js` for the exact allowlist — Google Sign-In and Microsoft MSAL script/style/frame origins are explicitly permitted)
- `author_ip` is stored on every post/comment and is admin-only — never exposed to other users, including on anonymous posts
- Self-signup is restricted to `student`/`teacher` roles at the app layer (`SELF_SIGNUP_ROLES` in `server/routes/auth.js`) — the DB's own `CHECK` constraint permits `'admin'`, so this allowlist is the only thing preventing self-registered admin accounts

## Project layout

```
├── server/
│   ├── index.js        # Express app, CSP/security headers, CORS, rate limiting
│   ├── config.js        # Config from env
│   ├── db.js            # Postgres schema + migrations + seeding
│   ├── sanitize.js       # Server-side content sanitization (DOMPurify)
│   ├── routes/           # API routes (auth, posts, comments, admin, notifications)
│   └── middleware/       # Auth + admin-auth middleware
├── src/                  # Frontend (app.js, styles.css, theme-init.js, config files)
├── index.html
├── render.yaml           # Render deployment (databases: block is unused, see above)
└── .gitignore
```
