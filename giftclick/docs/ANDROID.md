# 📱 기프트클릭 안드로이드 앱 + AdMob 실전 광고 가이드

받은 ID 두 개는 **AdMob(앱용)** 입니다. 웹사이트 `<ins>` 광고엔 넣을 수 없고,
이 프로젝트를 **안드로이드 앱으로 포장해서** 씁니다. (그래서 Capacitor 래퍼를 이미 설치/연동해 뒀어요)

| ID | 형식 | 역할 | 어디에 |
|---|---|---|---|
| `ca-app-pub-7015819519578636~3320128012` | 앱 ID | AdMob에 앱 식별 | `android/.../AndroidManifest.xml` ✅ (이미 주입됨) |
| `ca-app-pub-7015819519578636/7953507595` | 광고 단위 ID | 보상형 광고 재생 | `.env` 의 `NEXT_PUBLIC_ADMOB_REWARDED_ID` ✅ (이미 설정됨) |

## 준비물 (집 컴퓨터에서)

1. **Android Studio** 설치 (묵음) — 그라들/SDK 자동 구성됨
2. JDK 17 이상 (Android Studio 내장 Gradle JDK 사용 가능)
3. 이 저장소 클론 + `npm ci`

## 실행 순서

```bash
# 1) 저장소 받기 후
cd giftclick
npm ci

# 2) (선택) 로컬 폰 테스트라면 capacitor.config.ts 의 server.url을
#    내 PC 주소로 임시 지정:  url: "http://내PC낸IP:3000"  + cleartext: true
#    배포(Vercel) 후에는 https 도메인으로 교체 (기본이 안전한 https)
npm run build && npm start   # 폰 테스트 시 서버 같이 켜두기

# 3) 안드로이드 프로젝트 싱크 & Android Studio로 열기
npm run cap:sync
npm run cap:open
```

4. Android Studio에서 **에뮬레이터 만들기**(또는 USB 폰 연결, 개발자모드/디버깅 허용)
5. ▶ 실행 → 앱에서 "광고 보고 깨기권 받기" 버튼 → **진짜 AdMob 보상형 광고**가 전체화면으로 뜸

> 💡 앱 환경을 자동 감지합니다(`Capacitor.isNativePlatform()`).
> 브라우저에서는 지금처럼 5초 테스트 광고가, 앱에서는 진짜 광고가 나옵니다.

## 💵 돈이 실제로 흐르게 하려면 (꼭! 부모님과 함께)

| 단계 | 내용 | 비고 |
|---|---|---|
| 1 | **AdMob 계정 = 부모님 명의** + 지급정보(부모님 통장) 등록 | 만 18세 미만 본인 계정 불가 |
| 2 | 앱을 **Google Play에 등록** | 개발자 계정 $25(1회) — 부모님과 |
| 3 | AdMob에서 앱 ↔ 플레이 등록 연결 | 심사 며칠 |
| 4 | **SSV(서버 측 검증) 설정** ★추천 | 콘솔 → 광고단위 → SSV → 리워드 URL에 `https://YOUR-DOMAIN/api/ads/ssv` 입력. 구글 서버가 직접 지급을 호출 → 조작 불가 |
| 5 | `.env`에 `NEXT_PUBLIC_ADS_SSV_ACTIVE=1` + 재배포 | 클라 대신 서버가 지급하게 전환 |
| 6 | 수익은 부모님 통장에 **월 1회 자동 입금** ($100, 보통 21~26일) | 세금 신고는 부모님 |

> ⚠️ **SSV 없이도** 보상 지급은 동작해요(쿨타임/일일 한도는 서버가 강제).
> 다만 진짜 돈이 붙는 상용 단계에서는 SSV를 켜는 게 안전합니다.
> ⚠️ 친구한테 "내 광고 많이 봐줘!"라고 하면 **무효 클릭으로 계정 정지**될 수 있어요. 스스로/조작 클릭 금지!

## 남은 것들 (꾸준히)

- 앱 아이콘 커스텀 (`android/app/src/main/res/mipmap-*`) → 나중에 요청하면 디자인 만들어줄게요
- 스플래시 화면 (`@capacitor/splash-screen`)
- Vercel 배포 → `capacitor.config.ts`의 `server.url`을 실제 주소로

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| 광고가 안 뜨고 로드 실패 | 실기기 기준 광고 채우기(fill)까지 며칠 걸릴 수 있음 / 에뮬레이터는 Play 서비스 있는 이미지 사용 |
| 앱 화면이 하얀색 | `server.url` 미설정 또는 서버 미기동. 개발 중엔 `http://PC낸IP:3000` + `cleartext: true` 후 `npm run cap:sync` |
| SDK 라이선스 에러 | Android Studio > Settings > SDK Manager에서 SDK/빌드툴 설치 후 라이선스 동의 |
