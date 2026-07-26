# 🥚 기프트클릭 (GiftClick)

금계란을 **터치로 직접**, 또는 **자동 클릭 모드**로 두들겨 최대 **50,000원** 상품을 뽑는
클릭형 햅테크 풀스택 데모 앱입니다.

## 주요 기능

- 🔐 **인증** — 이메일/비밀번호 회원가입·로그인 (bcrypt 해시 + JWT httpOnly 쿠키 세션, 미들웨어 보호)
- 🥚 **금계란 게임** — 6~12번 두들기면 부화, 가중치 랜덤 상품 추첨, 자동 깨기 모드, 매일 자정 깨기권 충전
- 🎁 **상품 관리 CRUD** — 등록/수정/삭제/노출 토글, 가치·가중치·재고 설정, 카테고리 필터/검색
- 🎀 **기프트 보관함 CRUD** — 핀코드 발급/조회, 사용 완료 처리, 메모·정보 수정, 만료 자동 처리, 직접 등록
- 🧾 **깨기 내역** — 모든 터치 로그, 날짜별 그룹핑, 개별/전체 삭제
- 📊 **대시보드** — 주간 활동 차트, 연속 출석 스트릭, XP 레벨, 랭킹, 최근/최고 당첨
- ✨ **UX 폴리시** — 낙관적 업데이트(SWR), 로딩 스켈레톤, 빈 상태, 토스트, 컨페티, 반응형(모바일 드로어)

## 기술 스택

| 영역 | 스택 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) + React 19 + TypeScript |
| 스타일 | Tailwind CSS v4 (CSS-first 테마) |
| 데이터 | Node 22 내장 `node:sqlite` (파일 기반 SQLite, `data/giftclick.db`) |
| 인증 | jose (JWT) + bcryptjs, Edge 미들웨어 세션 검증 |
| 상태 | SWR (낙관적 뮤테이션 포함) |

## 실행 방법

```bash
npm install
npm run dev        # http://localhost:3000
```

첫 요청 시 SQLite 스키마가 생성되고 **데모 데이터가 자동 시딩**됩니다.

### 데모 계정

| 계정 | 비밀번호 | 설명 |
|---|---|---|
| `demo@giftclick.kr` | `demo1234` | 🐣 당첨/내역 데이터가 채워진 일반 유저 |
| `admin@giftclick.kr` | `admin1234` | 🛠️ 관리자 계정 |

```bash
npm run db:reset   # 데모 DB 초기화 후 재시딩
```

## 🤝 기프티콘 API 연동 (기프티엘)

당첨될 때마다 **프로바이더 어댑터**를 통해 쿠폰(핀코드)을 발급합니다. 상품 관리 페이지 상단의 연동 패널에서 상태와 카탈로그 동기화를 관리할 수 있어요.

| 항목 | 내용 |
|---|---|
| 프로바이더 | `lib/giftcon/` — `GiftconProvider` 인터페이스 + `sandbox` / `giftiel` 구현체 |
| 기본 동작 | **샌드박스 모드** — 키 없이 기프티엘과 동일한 발급·회수·카탈로그 플로우 재현 |
| 실전 전환 | `.env.example`을 `.env`로 복사 후 `GIFTCON_PROVIDER=giftiel` + `GIFTIEL_API_KEY`/`GIFTIEL_PARTNER_CODE` 입력 → 서버 재시작 |
| 발급 실패 시 | 사용자 흐름은 유지 — 로컬 핀으로 대체 발급하고 실패 이력만 `giftcon_issues`에 기록 |
| 동기화 | `POST /api/giftcon/sync` — 발급사 카탈로그를 상품 풀에 upsert (카테고리/이모지 자동 추론) |
| 회수 | 보관함에서 기프트 삭제 시 발급 쿠폰 회수(cancel) best-effort 호출 |

> ⚠️ 기프티엘의 실제 엔드포인트·필드명은 파트너 개발자 문서 기준으로 확정이 필요합니다.
> 모든 경로(`GIFTIEL_PATH_*`)와 응답 필드는 방어적 파싱 + env 오버라이드로 되어 있어 문서 확인 즉시 맞출 수 있습니다.

### 관련 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/giftcon/status` | 연동 모드/준비 여부/발급 통계/마지막 동기화 |
| GET | `/api/giftcon/goods` | 발급사 상품 카탈로그 조회 |
| POST | `/api/giftcon/sync` | 카탈로그 → 상품 풀 동기화 |

## 구조

```
app/
  (auth)/login, signup      # 인증 화면
  (app)/dashboard|game|products|rewards|history|profile
  api/auth|products|rewards|cracks|crack|credits|stats|profile|giftcon
components/                 # AppShell(사이드바), EggGame, GiftconPanel, Toast, Modal 등
lib/                        # db(SQLite), session/jwt, game 로직, giftcon(발급사 어댑터), seed, validators
middleware.ts               # 세션 가드 (엣지)
```

## 게임 경제

- 터치 1회 = 깨기권 1장 소모, +10 XP (부화 시 +500 XP)
- 8% 확률로 터치하더라도 깨기권 복원(별 반사)
- 부화 시 `weight` 가중치 기반 상품 추첨 → 재고 차감 → 핀코드 기프트 즉시 발급 (30일 유효)
- 깨기권: 매일 자정(KST) 5장 자동 충전 + 게임 화면의 미션 보상(30분 쿨타임 +3장)
