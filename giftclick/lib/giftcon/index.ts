import { GiftielProvider } from "./giftiel";
import { PayPalPayoutProvider } from "./paypal";
import { ManualFulfillmentProvider } from "./manual";
import { SandboxGiftconProvider } from "./sandbox";
import type { GiftconProvider } from "./provider";

export type { GiftconProvider } from "./provider";
export type { GiftconIssueResult, GiftconGoods } from "./provider";

declare global {
  var __GC_GIFTCON: GiftconProvider | undefined;
}

/**
 * 프로바이더 선택:
 * - GIFTCON_PROVIDER=giftiel → 기프티엘 실전 (파트너 키 필요)
 * - GIFTCON_PROVIDER=manual  → 수동 발송(직접 전달) — 학생 개발자가 사업자 없이 실제 운영 가능
 * - GIFTCON_PROVIDER=paypal  → PayPal Payouts 자동 송금 (부모님 비즈니스 계정 + Payouts 승인 필요)
 * - 그 외/미설정             → 샌드박스 (키 없이도 동일 플로우 재현)
 */
export function getGiftconProvider(): GiftconProvider {
  if (!globalThis.__GC_GIFTCON) {
    const kind = process.env.GIFTCON_PROVIDER;
    globalThis.__GC_GIFTCON =
      kind === "giftiel"
        ? new GiftielProvider()
        : kind === "paypal"
          ? new PayPalPayoutProvider()
          : kind === "manual"
            ? new ManualFulfillmentProvider()
            : new SandboxGiftconProvider();
  }
  return globalThis.__GC_GIFTCON;
}

export function giftconMode(): { name: string; mode: "sandbox" | "live"; ready: boolean } {
  const p = getGiftconProvider();
  return { name: p.name, mode: p.mode, ready: p.isReady() };
}
