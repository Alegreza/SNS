# School-Only SNS – Kobe

A closed SNS for high school (grades 9–12). Sign up with **email** or **username**, plus **Google** or **Microsoft**. School verification: manual (contact admin) or student ID upload.

## Quick start (local)

```bash
npm run install:server
npm start
```

Open `http://localhost:3000`

- Default admin: `admin` / `admin`

## GitHub setup

1. Create a new repo on GitHub.
2. In project root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## Deployment (Render)

1. Push your code to GitHub.
2. Go to [render.com](https://render.com) → New → Web Service.
3. Connect your GitHub repo.
4. Use settings (or `render.yaml`):
   - **Build command:** `npm run install:server`
   - **Start command:** `npm start`
5. Add environment variables:
   - `JWT_SECRET` – random string (generate on Render)
   - `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID` (optional)
6. Deploy.

**Note:** SQLite uses local storage. On Render, the DB is ephemeral unless you add a persistent disk. For long-term data, consider a managed DB later.

## Config

| Variable       | Description                          |
|----------------|--------------------------------------|
| `PORT`         | Server port (default 3000)           |
| `JWT_SECRET`   | Secret for JWT (required in prod)    |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional)         |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth (optional)  |

Copy `server/.env.example` to `server/.env` for local dev.

## Project layout

```
├── server/
│   ├── index.js      # Express app
│   ├── config.js     # Config from env
│   ├── db.js         # SQLite + migrations
│   ├── routes/       # API routes
│   └── middleware/   # Auth middleware
├── src/              # Frontend (app.js, styles, config)
├── index.html
├── render.yaml       # Render deployment
└── .gitignore
```
