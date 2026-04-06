# Kobe 배포 가이드 (name.com + Render.com)

## 1. Render 서비스 설정

1. Render.com → New Web Service → GitHub 레포 연결
2. `render.yaml`이 프로젝트 루트에 있으면 자동 감지
3. 환경변수 설정 (Render 대시보드 → Environment):

| 변수 | 값 | 필수 |
|------|-----|------|
| `JWT_SECRET` | 랜덤 32자 이상 문자열 | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `GOOGLE_CLIENT_ID` | Google Cloud Console에서 발급 | Phase 3 후 |
| `MICROSOFT_CLIENT_ID` | Azure AD 앱 등록에서 확인 | 이미 있음 |

---

## 2. 데이터베이스 선택

SQLite는 Render 무료 플랜에서 재배포 시 초기화됨.

| 방법 | 비용 | 난이도 | 추천 시점 |
|------|------|--------|-----------|
| **Render Persistent Disk** | $1/월 | 쉬움 | MVP |
| PostgreSQL (Render 관리형) | $7/월 | 코드 수정 필요 | 스케일업 후 |

→ **MVP 단계: Persistent Disk 선택** (Phase 4에서 설정)

Persistent Disk 설정 시 `render.yaml`에 추가:
```yaml
disk:
  name: kobe-data
  mountPath: /var/data
  sizeGB: 1
```
그리고 `server/db.js`의 DB 경로를 `/var/data/kobe.db`로 변경.

---

## 3. 도메인 연결 (name.com → Render)

### Render 쪽
1. Render 대시보드 → 서비스 선택 → Settings → Custom Domains
2. 도메인 입력 → Render가 CNAME 값 제공 (예: `xxx.onrender.com`)

### name.com 쪽
1. name.com 로그인 → My Domains → 도메인 선택 → Manage DNS
2. DNS 레코드 추가:

| Type | Host | Value |
|------|------|-------|
| `CNAME` | `www` | Render에서 받은 주소 |
| `CNAME` | `@` | Render에서 받은 주소 (루트 도메인) |

3. TTL: 300 (5분) 권장
4. 전파 시간: 최대 48시간 (보통 30분 이내)

### SSL
- Render가 Let's Encrypt로 자동 발급 및 갱신
- 별도 설정 불필요

---

## 4. Google OAuth 도메인 등록 (Phase 3 전 외부 작업)

1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 클라이언트 ID 선택 → 승인된 JavaScript 원본에 추가:
   - `https://yourdomain.com`
3. 승인된 리디렉션 URI:
   - `https://yourdomain.com/`
4. Client ID를 `src/auth-config.js`의 `googleClientId`에 입력

---

## 5. 배포 체크리스트

- [ ] GitHub 레포에 코드 push
- [ ] Render 서비스 생성 및 환경변수 설정
- [ ] Persistent Disk 연결 (Phase 4 후)
- [ ] Custom Domain 연결
- [ ] name.com DNS 설정
- [ ] SSL 인증서 확인
- [ ] Google OAuth Client ID 등록 (Phase 3 후)
- [ ] 기본 admin 비밀번호 변경
