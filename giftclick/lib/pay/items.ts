import type { CreditPackItem } from "@/lib/types";

/** 깨기권 충전 팩 카탈로그 (가격은 원화) */
export const CREDIT_PACKS: CreditPackItem[] = [
  { code: "PACK_5", title: "깨기권 5장", credits: 5, bonus: 0, price: 500 },
  { code: "PACK_12", title: "깨기권 12장", credits: 10, bonus: 2, price: 1000, tag: "인기" },
  { code: "PACK_33", title: "깨기권 33장", credits: 25, bonus: 8, price: 2500, tag: "가성비" },
];

export function findPack(code: string): CreditPackItem | null {
  return CREDIT_PACKS.find((p) => p.code === code) ?? null;
}

/** 확정 상품 직접구매 판매가 = 상품 가치 + 수수료(PAY_PRICE_FEE_PCT, 기본 5%), 100원 단위 올림 */
export function directPrice(value: number): number {
  const feePct = Number(process.env.PAY_PRICE_FEE_PCT ?? "5") || 0;
  const raw = value + (value * feePct) / 100;
  return Math.ceil(raw / 100) * 100;
}
