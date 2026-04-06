프로젝트: Kobe SNS
CLAUDE.md를 먼저 읽어서 전체 구조를 파악해줘.

목표: Google 로그인이 실제로 작동하고, Microsoft 토큰이 안전하게 검증된다.

작업:
1. server/routes/auth.js — Microsoft 토큰 검증을 jwt.decode() 대신 JWKS 서명 검증으로 교체 (jwks-rsa 패키지 사용)
2. src/auth-config.js — Google Client ID 입력란 주석으로 가이드 추가
3. server/config.js — GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID 환경변수 연동 확인
4. .env.example — 업데이트

격리 범위: auth.js 내 Microsoft 검증 로직만 수정. 나머지 auth 플로우 건드리지 않음.
Google Client ID 자체는 외부 작업 (Google Cloud Console)이라 코드에 값을 직접 넣지 말 것.

작업 전 ask_gpt로 설계 방향 확인하고 진행해줘.
