import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 기프트클릭 안드로이드 앱 래퍼 (Capacitor)
 *
 * 이 앱은 정적 파일이 아니라 "배포된 서버"를 웹뷰로 엽니다.
 * → server.url 을 실제 배포 주소(Vercel 등)로 바꿔야 합니다!
 *
 * 준비: docs/ANDROID.md 참고
 */
const config: CapacitorConfig = {
  appId: "com.giftclick.app",
  appName: "기프트클릭",
  webDir: "out",
  server: {
    // ▼▼▼ 배포 후 여기에 실제 주소 입력 ▼▼▼
    // url: "https://your-giftclick.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
