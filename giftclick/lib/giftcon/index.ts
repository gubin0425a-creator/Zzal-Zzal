import { GiftielProvider } from "./giftiel";
import { SandboxGiftconProvider } from "./sandbox";
import type { GiftconProvider } from "./provider";

export type { GiftconProvider } from "./provider";
export type { GiftconIssueResult, GiftconGoods } from "./provider";

declare global {
  var __GC_GIFTCON: GiftconProvider | undefined;
}

/**
 * 프로바이더 선택:
 * - GIFTCON_PROVIDER=giftiel  → 기프티엘 실전 (키가 있어야 발급 성공)
 * - 그 외/미설정             → 샌드박스 (키 없이도 동일 플로우 재현)
 */
export function getGiftconProvider(): GiftconProvider {
  if (!globalThis.__GC_GIFTCON) {
    globalThis.__GC_GIFTCON =
      process.env.GIFTCON_PROVIDER === "giftiel"
        ? new GiftielProvider()
        : new SandboxGiftconProvider();
  }
  return globalThis.__GC_GIFTCON;
}

export function giftconMode(): { name: string; mode: "sandbox" | "live"; ready: boolean } {
  const p = getGiftconProvider();
  return { name: p.name, mode: p.mode, ready: p.isReady() };
}
