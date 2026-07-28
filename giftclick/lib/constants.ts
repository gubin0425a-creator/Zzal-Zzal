import type { Category } from "./types";

export const COOKIE_NAME = "gc_session";
export const DAILY_CREDITS = 5;
export const XP_PER_CLICK = 10;
export const XP_PER_HATCH = 500;
export const XP_PER_LEVEL = 1000;
export const MAX_PRODUCT_VALUE = 50_000;
export const REWARD_EXPIRY_DAYS = 30;
export const BONUS_CREDIT_CHANCE = 0.08; // 8% 복권식 별도 볼륨

export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(xp: number): number {
  return xp % XP_PER_LEVEL;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  COFFEE: "커피/음료",
  FOOD: "치킨/외식",
  CONVENIENCE: "편의점",
  CULTURE: "문화/엔터",
  BEAUTY: "뷰티/기타",
  ETC: "기타",
};

export const CATEGORY_EMOJIS: Record<Category, string> = {
  COFFEE: "☕",
  FOOD: "🍗",
  CONVENIENCE: "🏪",
  CULTURE: "🎬",
  BEAUTY: "💄",
  ETC: "🎁",
};

export const REWARD_STATUS_LABELS = {
  READY: "사용 가능",
  USED: "사용 완료",
  EXPIRED: "기간 만료",
} as const;

export type Tier = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";

export function tierOf(value: number): Tier {
  if (value >= 40_000) return "LEGENDARY";
  if (value >= 15_000) return "RARE";
  if (value >= 6_000) return "UNCOMMON";
  return "COMMON";
}

export const TIER_LABELS: Record<Tier, string> = {
  COMMON: "커먼",
  UNCOMMON: "언커먼",
  RARE: "레어",
  LEGENDARY: "레전더리",
};

export const AVATARS = ["🐣", "🐤", "🦊", "🐰", "🐻", "🐼", "🐯", "🐸", "🦄", "😎"];

/** 이지모드 해치 풀 상한 — 이 가치 이하 상품만 당첨 가능 */
export const EASY_HATCH_MAX_VALUE = 5000;

// ── 🎯 확정 드랍 게이지 (광고 시청으로 채우는 확정 보상 게이지) ──
function intEnv(name: string, def: number, min: number, max: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** 광고 1회 시청당 게이지 충전액(원) — ⚠️ 게임 내 가치이며 실제 광고 수익이 아님!
 *  실제 보상형 광고 수익은 1회당 약 2~10원 수준이라 이 값이 크면 적자 구조가 됨.
 *  재미 우선 기본 100원, 수익 맞추려면 ADS_GUARANTEE_FILL=5~10 권장 */
export const GUARANTEE_FILL_KRW = intEnv("ADS_GUARANTEE_FILL", 100, 1, 100_000);
/** 확정 드랍 목표 = 대표 상품 가격 + 이 마진 (예: 5,000원 카드 → 목표 7,000원) */
export const GUARANTEE_MARGIN_KRW = intEnv("ADS_GUARANTEE_MARGIN", 2000, 0, 100_000);
/** 이 가격 이하 대표 상품 알에만 게이지가 붙음 (고가 상품 확정 남발 방지) */
export const GUARANTEE_MAX_PRODUCT_VALUE = intEnv("ADS_GUARANTEE_MAX_VALUE", 5000, 0, 1_000_000);
