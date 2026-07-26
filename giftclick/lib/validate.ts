import { MAX_PRODUCT_VALUE } from "./constants";
import type { Category } from "./types";

const CATEGORIES: Category[] = ["COFFEE", "FOOD", "CONVENIENCE", "CULTURE", "BEAUTY", "ETC"];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProductInput {
  name: string;
  brand: string;
  category: Category;
  description: string;
  emoji: string;
  value: number;
  weight: number;
  stock: number;
  active: boolean;
}

export function validateProduct(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  base?: Partial<ProductInput>,
): { data: ProductInput } | { error: string } {
  const out: ProductInput = {
    name: base?.name ?? "",
    brand: base?.brand ?? "",
    category: base?.category ?? "ETC",
    description: base?.description ?? "",
    emoji: base?.emoji ?? "🎁",
    value: base?.value ?? 0,
    weight: base?.weight ?? 10,
    stock: base?.stock ?? -1,
    active: base?.active ?? true,
  };

  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.brand !== undefined) out.brand = String(body.brand).trim();
  if (body.description !== undefined) out.description = String(body.description).trim();
  if (body.emoji !== undefined) out.emoji = String(body.emoji).trim() || "🎁";
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return { error: "카테고리가 올바르지 않습니다." };
    out.category = body.category;
  }
  if (body.value !== undefined) {
    const v = Number(body.value);
    if (!Number.isFinite(v) || v < 500 || v > MAX_PRODUCT_VALUE)
      return { error: `상품 가치는 500원 ~ ${MAX_PRODUCT_VALUE.toLocaleString("ko-KR")}원 사이여야 합니다.` };
    out.value = Math.round(v);
  }
  if (body.weight !== undefined) {
    const w = Number(body.weight);
    if (!Number.isFinite(w) || w <= 0 || w > 100)
      return { error: "당첨 가중치는 0 초과 100 이하여야 합니다." };
    out.weight = w;
  }
  if (body.stock !== undefined) {
    const s = Number(body.stock);
    if (!Number.isInteger(s) || s < -1 || s > 9999)
      return { error: "재고는 -1(무제한) 이상의 정수여야 합니다." };
    out.stock = s;
  }
  if (body.active !== undefined) out.active = !!body.active;

  if (!out.name || out.name.length > 60) return { error: "상품명은 1~60자로 입력해주세요." };
  if (out.brand.length > 40) return { error: "브랜드명은 40자 이하로 입력해주세요." };
  if (out.description.length > 200) return { error: "설명은 200자 이하로 입력해주세요." };
  if (out.value < 500) return { error: "상품 가치는 최소 500원 이상이어야 합니다." };

  return { data: out };
}

export interface RewardInput {
  title: string;
  brand: string;
  emoji: string;
  value: number;
  memo: string;
  status?: "READY" | "USED";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateReward(body: any): { data: RewardInput } | { error: string } {
  const title = String(body.title ?? "").trim();
  const brand = String(body.brand ?? "").trim();
  const emoji = String(body.emoji ?? "").trim() || "🎁";
  const memo = String(body.memo ?? "").trim();
  const value = Number(body.value);
  const status = body.status === "USED" ? "USED" : "READY";

  if (!title || title.length > 60) return { error: "기프트 이름은 1~60자로 입력해주세요." };
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRODUCT_VALUE)
    return { error: `금액은 0 ~ ${MAX_PRODUCT_VALUE.toLocaleString("ko-KR")}원 사이여야 합니다.` };
  if (memo.length > 200) return { error: "메모는 200자 이하로 입력해주세요." };

  return { data: { title, brand, emoji, value: Math.round(value), memo, status } };
}
