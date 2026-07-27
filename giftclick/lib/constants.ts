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
