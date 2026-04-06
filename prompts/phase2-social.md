프로젝트: Kobe SNS
CLAUDE.md를 먼저 읽어서 전체 구조를 파악해줘.

목표: 포스트에 댓글을 달 수 있고, 댓글이 달리면 알림이 생긴다.

작업:
1. server/db.js — comments 테이블, notifications 테이블 추가
2. server/routes/comments.js — GET/POST /api/posts/:id/comments
3. server/routes/notifications.js — GET /api/notifications (폴링, 읽음 처리 포함)
4. server/index.js — 두 라우트 등록
5. src/app.js — 포스트 카드에 댓글 섹션 (펼침/접힘)
6. src/app.js — Notifications 탭을 API 연동으로 전환 (5초 폴링)

격리 범위: comments, notifications 테이블 신규. posts 테이블은 FK 참조만.

작업 전 ask_gpt로 설계 방향 확인하고 진행해줘.
