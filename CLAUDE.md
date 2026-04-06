# Kobe — Project Context

School-only SNS for Cranbrook high school students (grades 9–12). Closed platform: users must be verified before posting.

## Tech Stack

- **Frontend**: Vanilla JS (no build step, no framework). Single IIFE in `src/app.js`. Must stay ES5-compatible for `file://` fallback.
- **Backend**: Node.js + Express, port 3000
- **Database**: SQLite via `better-sqlite3` (synchronous API)
- **Auth**: JWT (stored in localStorage), Google OAuth, Microsoft MSAL (Azure AD)
- **Deploy**: Render.com via `render.yaml`

## Project Structure

```
01. Kobe/
├── index.html          # SPA entry point
├── src/
│   ├── app.js          # Entire frontend (state + UI + event handlers)
│   ├── styles.css      # All CSS (CSS variables, mobile-first)
│   ├── api-config.js   # Sets window.API_BASE
│   ├── auth-config.js  # Google OAuth config (clientId empty — not yet set)
│   └── msal-config.js  # Microsoft MSAL config (clientId set)
└── server/
    ├── index.js        # Express app
    ├── db.js           # SQLite schema + migrations + seeding
    ├── config.js       # Env-based config
    ├── middleware/auth.js
    └── routes/
        ├── auth.js     # /api/auth/* (signup, login, google, microsoft, me)
        └── posts.js    # /api/spaces, /api/posts, /api/posts/feed
```

## Core Features

- **Spaces**: Class (per grade), Subject (per grade), Club (all grades)
- **Sections per space**: Announcements & Assignments / Questions / Anonymous & Vent
- **Access control**: Teachers cannot post in "Anonymous / Vent" (student-only)
- **Verification**: manual (admin approves), student_id (photo upload), school_sso (placeholder)
- **Roles**: student / teacher / admin

## Coding Conventions

- Frontend (`src/app.js`): no ES modules, no `import/export`, IIFE wrapper. Use `var`/`let`/`const` freely inside.
- All DOM manipulation is imperative (no virtual DOM). `el(tag, cls)` helper creates elements.
- State lives in `userState` and `appViewState` objects inside the IIFE.
- API calls go through `apiCall(path, options)` which attaches the JWT header automatically.
- Data loaded from API is cached in `spaces[]`, `posts[]`, `homeFeed[]` arrays.
- Backend uses synchronous `better-sqlite3` — no async/await in DB calls.
- All routes use `auth` middleware from `server/middleware/auth.js`.
- JWT payload includes: `userId`, `id`, `email`, `role`, `grade`, `name`.

## Key Constraints

- No npm build step — frontend files are served as-is by Express static middleware.
- SQLite DB path: `server/data/kobe.db` — ephemeral on Render unless Persistent Disk is added.
- Default admin: email `admin`, password `admin` (seeded in `db.js`) — change before production.
- Google OAuth Client ID is currently empty in `src/auth-config.js` — Google login won't work until set.
- Microsoft MSAL token validation is simplified (no signature check) — needs proper validation for production.

## GPT 협업

이 프로젝트는 Claude Code + GPT-4o 듀얼 에이전트 방식으로 작업합니다.

- MCP 서버 `openai-gpt`가 등록되어 있음 (`~/.claude/settings.json` 및 프로젝트 루트 `.mcp.json`)
- `ask_gpt` 툴로 GPT에게 의견을 물어볼 수 있음
- **작업 시작 시**: 구현 방향을 정하기 전에 GPT 의견을 먼저 구할 것
- **작업 중**: 중요한 설계 결정이나 트레이드오프가 있을 때 GPT에게 검토 요청
- **작업 완료 후**: GPT에게 코드 리뷰 요청 후 마무리

```js
// 사용 예시 — 세션 시작 시
ask_gpt("Phase 1 관리자 대시보드 구현 방향에 대해 의견 줘. [컨텍스트 요약]")
```

---

## Development Roadmap

각 Phase는 독립 세션에서 진행. 이전 Phase가 완료된 후 새 세션을 열고 아래 "시작 방법"을 그대로 붙여넣어 시작하면 됩니다.

### Phase 1 — 인증 완성 [ ]
**목표**: 가입한 유저가 자신의 상태를 알 수 있고, 관리자가 승인/거부할 수 있다.

**작업 목록**:
- [ ] `server/routes/admin.js` 생성: `GET /api/admin/users`, `PATCH /api/admin/users/:id/verify`
- [ ] 프론트 Profile 탭에 인증 상태 뱃지 표시 (pending / approved / rejected)
- [ ] 프론트 관리자 전용 탭 또는 모달: 대기 중인 유저 목록 + 승인/거부 버튼
- [ ] `server/index.js`에 admin 라우트 등록

**격리 범위**: `server/routes/admin.js` 신규 파일만 건드림. 기존 라우트 수정 없음.

**세션 시작 방법**:
```
CLAUDE.md 읽고 Phase 1 작업 시작해줘.
관리자 대시보드(유저 승인/거부)랑 프론트 인증 상태 표시가 목표야.
작업 전에 GPT한테 구현 방향 먼저 물어보고, 설계 결정마다 같이 검토해줘.
```

---

### Phase 2 — 소셜 기능 [ ]
**목표**: 포스트에 댓글을 달 수 있고, 댓글이 달리면 알림이 생긴다.

**작업 목록**:
- [ ] DB에 `comments` 테이블 추가 (`db.js` 수정)
- [ ] `server/routes/comments.js` 생성: `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- [ ] DB에 `notifications` 테이블 추가
- [ ] `server/routes/notifications.js` 생성: `GET /api/notifications` (폴링 방식)
- [ ] 프론트: 포스트 카드에 댓글 섹션 추가
- [ ] 프론트: Notifications 탭을 실제 API 연동으로 전환

**격리 범위**: `comments`, `notifications` 테이블과 라우트만 신규 추가. `posts` 테이블은 FK 참조만.

**세션 시작 방법**:
```
CLAUDE.md 읽고 Phase 2 작업 시작해줘.
포스트 댓글 기능이랑 알림 API 구현이 목표야.
작업 전에 GPT한테 구현 방향 먼저 물어보고, 설계 결정마다 같이 검토해줘.
```

---

### Phase 3 — 보안 강화 [ ]
**목표**: Google 로그인이 실제로 작동하고, Microsoft 토큰이 안전하게 검증된다.

**작업 목록**:
- [ ] Google Cloud Console에서 OAuth Client ID 발급 (외부 작업)
- [ ] `src/auth-config.js`에 Google Client ID 입력
- [ ] `server/config.js`에 `GOOGLE_CLIENT_ID` 환경변수 연동 확인
- [ ] `server/routes/auth.js`의 Microsoft 토큰 검증을 JWKS 서명 검증으로 교체
- [ ] `.env.example` 업데이트

**격리 범위**: `src/auth-config.js`, `server/routes/auth.js` 내 Microsoft 검증 로직만 수정.

**세션 시작 방법**:
```
CLAUDE.md 읽고 Phase 3 작업 시작해줘.
Google OAuth 설정이랑 Microsoft 토큰 서명 검증이 목표야.
작업 전에 GPT한테 구현 방향 먼저 물어보고, 설계 결정마다 같이 검토해줘.
```

---

### Phase 4 — 프로덕션 준비 [ ]
**목표**: Render 배포 시 데이터가 유실되지 않고, 보안 기본값이 설정된다.

**작업 목록**:
- [ ] Render Persistent Disk 설정 또는 PostgreSQL 전환 결정
- [ ] `render.yaml` 업데이트 (Persistent Disk 마운트 또는 PostgreSQL 서비스 추가)
- [ ] 기본 admin 계정 교체 플로우 (초기 실행 시 강제 비번 변경)
- [ ] 환경변수 체크리스트 (`JWT_SECRET`, `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`)
- [ ] Rate limiting 추가 (`express-rate-limit`)

**격리 범위**: 인프라 설정과 `render.yaml`만 건드림. 앱 로직 변경 최소화.

**세션 시작 방법**:
```
CLAUDE.md 읽고 Phase 4 작업 시작해줘.
Render 프로덕션 배포 안정화가 목표야.
작업 전에 GPT한테 구현 방향 먼저 물어보고, 설계 결정마다 같이 검토해줘.
```
