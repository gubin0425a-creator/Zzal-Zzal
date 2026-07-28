/**
 * 앱 아이콘 자동 생성 스크립트 — assets/store/icon-master.png 하나로
 * - 스토어용 icon-512.png (배경화이트 여백 자동 크롭)
 * - 안드로이드 mipmap-* 런처 아이콘 전 사이즈
 *
 * 실행: node scripts/make-icons.mjs  (npm run icons)
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const SRC = "assets/store/icon-master.png";
const STORE_OUT = "assets/store/icon-512.png";
const ANDROID_RES = "android/app/src/main/res";

const LAUNCHER_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function main() {
  const img = sharp(SRC);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("마스터 아이콘을 읽을 수 없어요.");

  // 생성 이미지 가장자리 흰 여백 크롭 (중앙 90%)
  const side = Math.min(meta.width, meta.height);
  const crop = Math.round(side * 0.9);
  const left = Math.round((meta.width - crop) / 2);
  const top = Math.round((meta.height - crop) / 2);
  const cropped = img.extract({ left, top, width: crop, height: crop });
  const masterBuf = await cropped.png().toBuffer();

  // 스토어 512
  await sharp(masterBuf).resize(512, 512).png().toFile(STORE_OUT);
  console.log("✅", STORE_OUT);

  for (const [dpi, px] of Object.entries(LAUNCHER_SIZES)) {
    const dir = path.join(ANDROID_RES, `mipmap-${dpi}`);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(masterBuf).resize(px, px).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(masterBuf).resize(px, px).png().toFile(path.join(dir, "ic_launcher_round.png"));
  }
  for (const [dpi, px] of Object.entries(FOREGROUND_SIZES)) {
    const dir = path.join(ANDROID_RES, `mipmap-${dpi}`);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(masterBuf).resize(px, px).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  }
  console.log("✅ 안드로이드 mipmap-* 아이콘 전 사이즈 갱신 완료");
  console.log("💡 나중에 아이콘 바꾸려면 icon-master.png 교체 후 다시 실행!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
