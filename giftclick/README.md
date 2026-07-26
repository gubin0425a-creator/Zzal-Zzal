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

## 구조

```
app/
  (auth)/login, signup      # 인증 화면
  (app)/dashboard|game|products|rewards|history|profile
  api/auth|products|rewards|cracks|crack|credits|stats|profile
components/                 # AppShell(사이드바), EggGame, Toast, Modal 등
lib/                        # db(SQLite), session/jwt, game 로직, seed, validators
middleware.ts               # 세션 가드 (엣지)
```

## 게임 경제

- 터치 1회 = 깨기권 1장 소모, +10 XP (부화 시 +500 XP)
- 8% 확률로 터치하더라도 깨기권 복원(별 반사)
- 부화 시 `weight` 가중치 기반 상품 추첨 → 재고 차감 → 핀코드 기프트 즉시 발급 (30일 유효)
- 깨기권: 매일 자정(KST) 5장 자동 충전 + 게임 화면의 미션 보상(30분 쿨타임 +3장)
