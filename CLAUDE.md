# Kobe — Project Context

School-only SNS for Cranbrook high school students (grades 9–12). Closed platform: users must be verified before posting.

## Tech Stack

- **Frontend**: Vanilla JS (no build step, IIFE wrapper). Single file `src/app.js`. ES5-compatible for `file://` fallback.
- **Backend**: Node.js + Express, port 3000
- **Database**: PostgreSQL via `pg` pool (Render managed DB `kobe-db`)
- **Auth**: JWT (localStorage), Google OAuth, Microsoft MSAL (Azure AD) with JWKS signature verification
- **Logging**: `pino` + `pino-http` (JSON structured logs on Render stdout)
- **Deploy**: Render.com via `render.yaml` (web service + PostgreSQL)

## Project Structure

```
01. Kobe/
├── index.html              # SPA entry point (Noto Sans KR via Google Fonts)
├── render.yaml             # Render: web service + PostgreSQL kobe-db
├── .env.example            # Full env checklist
├── src/
│   ├── app.js              # Entire frontend (state + UI + event handlers)
│   ├── styles.css          # Everytime-style: red accent, sidebar, dense cards
│   ├── api-config.js       # Sets window.API_BASE
│   ├── auth-config.js      # Google OAuth config
│   └── msal-config.js      # Microsoft MSAL config
└── server/
    ├── index.js            # Express: pino-http, trust proxy, IP middleware, rate limit
    ├── db.js               # PostgreSQL schema + migrations + seeding (async)
    ├── config.js           # Env-based config
    ├── middleware/
    │   ├── auth.js         # JWT Bearer + cookie auth
    │   └── adminAuth.js    # Admin role guard
    └── routes/
        ├── auth.js         # /api/auth/* (signup, login, google, microsoft, me)
        ├── posts.js        # /api/spaces, /api/posts, /api/posts/feed
        ├── comments.js     # /api/posts/:id/comments
        ├── notifications.js# /api/notifications
        └── admin.js        # /api/admin/* (users, posts, spaces/teacher assignment)
```

## DB Schema (PostgreSQL)

- `users` — id, email, username, name, password_hash, role, grade, verification_status, ...
- `user_providers` — OAuth provider links (google, microsoft, email)
- `user_spaces` — teacher→space assignment (students filtered by grade logic)
- `spaces` — id(text), type(class|subject|club), name, grade
- `posts` — id, space_id, section, title, content, author_id, author_name, author_role, is_anonymous, **author_ip**, created_at
- `comments` — id, post_id, author_id, author_name, author_role, is_anonymous, content, **author_ip**, created_at
- `notifications` — id, user_id, type, post_id, actor_name, message, is_read, created_at
- `uploads` — student ID photos

## Core Features (Implemented)

- **Spaces**: Class (per grade), Subject (per grade), Club (all grades)
- **Sections**: Announcements & Assignments / Questions / Anonymous & Vent
- **Access control**:
  - Students see grade-matched class/subject + all clubs
  - Teachers see only spaces assigned via `user_spaces` (admin assigns)
  - Admin sees everything
  - Teachers cannot post in "Anonymous / Vent"
- **Verification**: manual (admin approves), student_id (photo upload), school_sso (placeholder)
- **Roles**: student / teacher / admin
- **Comments + Notifications**: comment on posts triggers notification to post author
- **Admin capabilities**:
  - 회원 관리: list/approve/reject users by verification status
  - 게시물 관리: view all posts with **real author name + IP** (including anonymous), delete posts
  - 공간 배정: assign/remove teachers to specific spaces
- **IP tracking**: every post and comment stores `author_ip` (X-Forwarded-For via Render proxy)
- **Anonymous reveal**: only admin receives real `author_name` + `author_ip` for anonymous posts/comments
- **Rate limiting**: 100 req / 15 min on `/api/*`
- **Logging**: pino structured JSON logs; auth events, admin actions, errors all logged

## Design (Everytime-style)

- Red primary: `#e53935`
- Top sticky navbar (red), left sidebar board list, dense post card list
- Post card: section badge + title + [comment count] / excerpt / author · date
- Admin reveal badge: purple `🔍 realname · IP: x.x.x.x`
- Noto Sans KR font via Google Fonts CDN
- Mobile: sidebar stacks above content

## Coding Conventions

- Frontend (`src/app.js`): no ES modules, IIFE wrapper. `var`/`let`/`const` freely inside.
- DOM manipulation imperative. `el(tag, cls)` helper creates elements.
- State: `userState` + `appViewState` inside IIFE.
- API calls via `apiCall(path, options)` — attaches JWT header automatically.
- Backend: async/await (PostgreSQL `pg` pool). `query`, `queryOne`, `run` wrappers in `db.js`.
- All routes use `auth` middleware. Admin routes additionally use `adminAuth`.
- JWT payload: `userId`, `id`, `email`, `role`, `grade`, `name`.
- Logging: use `req.log.info/error` (pino) in routes, not `console.*`.

## Key Constraints

- No npm build step — frontend files served as-is by Express static middleware.
- DB: PostgreSQL on Render (persistent, no data loss on redeploy).
- Default admin: email `admin`, password `admin` — **change before production** (startup warning printed).
- Google OAuth Client ID is currently empty in `src/auth-config.js`.
- Microsoft MSAL: JWKS signature verification implemented (jwks-rsa).
- `author_ip` is stored raw — treat as PII, only expose to admin role.

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

## GPT 협업

- MCP 서버 `openai-gpt` 등록됨 (`~/.claude/settings.json` 및 `.mcp.json`)
- `ask_gpt` 툴로 GPT에게 의견 요청 가능
- **작업 시작 시**: 구현 방향 GPT 검토 먼저
- **설계 결정 시**: GPT 리뷰 후 진행

---

## Development Roadmap

### ✅ Phase 1 — 인증 완성 [완료]
- `server/routes/admin.js`: `GET /api/admin/users`, `PATCH /api/admin/users/:id/verify`
- 프론트 Profile 탭: 인증 상태 배지 (pending / approved / rejected)
- 프론트 Admin 탭: 대기 중인 유저 목록 + 승인/거부

### ✅ Phase 2 — 소셜 기능 [완료]
- `comments` 테이블 + `GET/POST /api/posts/:id/comments`
- `notifications` 테이블 + `GET /api/notifications`, `PATCH` read 처리
- 프론트: 포스트 카드 댓글 토글 + 댓글 폼
- 프론트: Notifications 탭 실시간 폴링 (15초)

### ✅ Phase 3 — 보안 강화 [완료]
- Microsoft 토큰 JWKS 서명 검증 (`jwks-rsa`)
- `express-rate-limit`: 100req/15min on `/api/*`
- `.env.example` 전체 환경변수 체크리스트
- 초기 실행 시 admin 기본 비번 경고 (`bcrypt.compare`)

### ✅ Phase 4 — 프로덕션 준비 [완료]
- `render.yaml`: PostgreSQL 서비스(`kobe-db`) + `DATABASE_URL` 연동
- DB: SQLite → PostgreSQL 전환 (데이터 영속성 확보)
- `trust proxy 1` + X-Forwarded-For IP 추출 미들웨어
- pino + pino-http 구조화 로그

### ✅ Phase 5 — 디자인·로그·보안 심화 [완료]
- **디자인**: 에브리타임 스타일 (빨간 accent, navbar, 사이드바, 조밀한 카드)
- **Space 접근 제어**: 교사 → `user_spaces` 배정 기반 / 학생 → grade 기반
- **IP 추적**: posts·comments `author_ip` 저장, 어드민만 조회 가능
- **익명 실명 공개**: 어드민에게 익명 글의 실제 작성자 + IP 노출
- **Admin 탭 확장**: 회원관리 / 게시물관리(IP조회·삭제) / 공간배정(교사 배정)
- **pino 로그**: auth 이벤트, admin 액션, 에러 구조화 기록

---

## 다음 세션 시작 방법

```
CLAUDE.md 읽고 다음 Phase 작업 시작해줘.
작업 전에 GPT한테 구현 방향 먼저 물어보고, 설계 결정마다 같이 검토해줘.
```

## 남은 과제 (미구현)

- Google OAuth Client ID 발급 및 `src/auth-config.js` 설정 (외부 작업)
- XSS 방지: DOMPurify로 포스트/댓글 내용 sanitize
- CSP 헤더: `helmet.js` 적용
- JWT → HttpOnly Cookie 전환 (현재 localStorage)
- 다크 모드
- 마이크로 인터랙션 (CSS transitions)
- 로그 보존 기간 정책 (Render 로그 rotation)
