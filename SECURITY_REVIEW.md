# 외래 진료 운영 대시보드 — 운영 배포 전 보안 점검 결과

| 항목 | 내용 |
|---|---|
| 시스템 | 외래 진료 운영 대시보드 (Outpatient Operations Dashboard) |
| 스택 | Node.js 22 + Express + PostgreSQL + Prisma + React 18 + Vite |
| 점검 일자 | 2026-05-14 |
| 점검자 | jyun-n |
| 저장소 | github.com/jyun-n/session-dashboard (branch: `develop`) |

---

## 1. 애플리케이션 보안 점검 결과 (개발자 책임 영역) — 통과

### 인증·인가
- JWT 기반 인증, **HS256 알고리즘 명시** (none 알고리즘 우회 차단)
- JWT_SECRET 32자 이상 강제 + placeholder 패턴 거부 (zod 검증)
- 토큰 만료 15분, 401 응답 시 클라이언트 자동 로그아웃
- Role 기반 접근 제어 (ADMIN / USER)

### 비밀번호
- bcrypt 해싱 (cost=12)
- 신규/변경 비번 정책: **10자 이상 + 영문대/소/숫자/특수문자 중 3종 이상**
- 시드 관리자 비번 코드 노출 제거 (`SEED_ADMIN_PASSWORD` env 강제)

### 무차별 대입 방어 (3중 방어)
- ID당 5회 실패 → **30분 잠금**
- 로그인 IP 제한: 15분당 20회 (실패만 카운트)
- 전역 API 제한: 15분당 1,000회/IP
- `express-rate-limit` v8 메모리 스토어 (PM2 instances=1 고정으로 일관성 보장)

### 입력 검증
- 모든 사용자 입력 zod 스키마 검증
- SQL Injection: Prisma ORM 매개변수 바인딩 — **차단**
- XSS: React JSON API + `dangerouslySetInnerHTML` 미사용 — **위험 낮음**

### 보안 헤더 (helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'none'` (클릭재킹 차단)
- `Referrer-Policy: no-referrer` (의료 정보 외부 노출 최소화)
- `X-Powered-By` 제거
- CSP `base-uri 'self'`, `object-src 'none'`

### 시크릿 관리
- `.env` 깃 추적 금지 (`.gitignore` 처리 확인)
- `DELETE_SECRET` 비교: `crypto.timingSafeEqual` 사용 (timing attack 차단)
- placeholder 패턴 (`change-me`, `dashboard-jwt` 등) 시작 시 거부

### 의존성
- `npm audit`: **0 vulnerabilities** (fast-xml-builder 패치 완료)
- 미사용 의존성 제거 완료

---

## 2. 인프라에서 조치 필요 — 운영 가동 전 필수

### 🔴 필수 (미적용 시 운영 가동 금지)
- [ ] **HTTPS/SSL 인증서 적용** — 사내 CA 또는 공인 인증서로 운영 도메인 보호
- [ ] Nginx 리버스 프록시 구성 (백엔드 4000 포트는 외부 노출 차단)
- [ ] 운영 `backend/.env` 작성
  - `JWT_SECRET`: 32자+ 강한 랜덤 (`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`)
  - `DELETE_SECRET`: 강한 랜덤 (동일 방식)
  - `DATABASE_URL`: 운영 DB 비밀번호 (특수문자 URL 인코딩 필수)
  - `CORS_ORIGIN`: **운영 도메인만 명시 (와일드카드 `*` 금지)**
  - `EMR_BASE_URL`, `EMR_INST_CD`: 운영 EMR 주소
- [ ] `backend/.env` 권한 `chmod 600`

### 🟠 강하게 권장
- [ ] HSTS 활성화 — HTTPS 안정화 후 `backend/src/app.ts` 의 `strictTransportSecurity: false` 를 `{ maxAge: 300, includeSubDomains: true }` 로 교체 → 안정 후 `maxAge: 31536000`
- [ ] Nginx 단 CSP 헤더 추가 (HTML 응답 보호)
- [ ] 로그 회전 설정 (`logrotate`로 `backend/logs/*.log` 관리)
- [ ] 헬스체크 `/api/health` 내부망 only로 제한 (DB 상태 정보 외부 노출 차단)

### 🟡 운영 절차
- [ ] 시드 실행 시 강한 비번 사용, 즉시 로그인 → 비번 변경, `history -c`
- [ ] PM2 부팅 자동 시작 (`pm2 startup` + `pm2 save`)
- [ ] **PM2 instances: 1 유지 필수** (Rate limiter / 로그인 잠금이 메모리 기반)

---

## 3. 운영 환경 요구사항

- **OS**: Ubuntu (또는 Linux), 시스템 타임존 **UTC** (애플리케이션 내부 KST 변환)
- **Node.js**: 18 LTS 이상 (개발 환경 22.x 검증)
- **PostgreSQL**: 14 이상
- **PM2**: 5.x 이상
- **Nginx**: HTTPS 종단 및 정적 파일(`frontend/dist`) 서빙

---

## 4. 외부 의존성 (네트워크)

- **EMR API**: `http://emr124.cauhs.or.kr/cmcnu/.live` (운영 시 운영 EMR 주소로 환경변수 교체)
- **수집 스케줄**: KST 06:00 / 18:00 / 00:05 자동 + 서버 시작 시 catch-up

---

## 5. 남은 후속 권장 (운영 가동 후 단계적 개선)

- JWT refresh token 도입 (현재는 만료 시 재로그인 — UX 개선 여지)
- 로그인 시도 카운트 Redis 이동 (현재 메모리 기반, 다중 인스턴스 대비)
- 보안 로그 모니터링 (실패 로그인 / 429 응답 / 인증 실패 패턴 알림)
- 의존성 자동 업데이트 (`npm audit` 정기 점검 또는 Dependabot)

---

**결론:** 애플리케이션 레이어 보안 점검 통과. 위 §2 인프라 조치 사항이 모두 완료된 후 운영 가동 가능.
