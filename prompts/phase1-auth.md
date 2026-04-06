프로젝트: Kobe SNS (학교 전용 SNS, Vanilla JS + Express/SQLite)
CLAUDE.md를 먼저 읽어서 전체 구조를 파악해줘.

목표: 관리자가 가입 대기 유저를 승인/거부할 수 있고, 유저는 자신의 인증 상태를 볼 수 있다.

작업:
1. server/middleware/adminAuth.js — admin role 전용 미들웨어 (auth() 이후 체이닝)
2. server/routes/admin.js — GET /api/admin/users?status=, PATCH /api/admin/users/:id/verify
3. server/index.js — admin 라우트 등록 (/api/admin)
4. src/app.js — Admin 탭 추가 (role=admin일 때만 표시), 대기 유저 목록 + 승인/거부 버튼 UI
5. src/app.js — Profile 탭에 인증 상태 뱃지 (pending/approved/rejected)

격리 범위: server/routes/admin.js 신규. 기존 라우트 수정 없음.
이메일 알림은 이번 Phase 범위 아님.

작업 전 ask_gpt로 설계 방향 확인하고 진행해줘.
