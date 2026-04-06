프로젝트: Kobe SNS
CLAUDE.md를 먼저 읽어서 전체 구조를 파악해줘.

목표: Render 배포 시 데이터가 유실되지 않고, 보안 기본값이 설정된다.

작업:
1. render.yaml — Persistent Disk 마운트 추가 (SQLite 유지) 또는 PostgreSQL 서비스 추가
2. server/index.js — express-rate-limit으로 /api/* 요청 제한 (15분에 100회)
3. server/db.js — 초기 실행 시 admin 비밀번호가 기본값이면 콘솔 경고 출력
4. .env.example — 전체 환경변수 체크리스트로 업데이트

격리 범위: 인프라 설정과 미들웨어만. 앱 비즈니스 로직 수정 없음.

작업 전 ask_gpt로 설계 방향 확인하고 진행해줘.
