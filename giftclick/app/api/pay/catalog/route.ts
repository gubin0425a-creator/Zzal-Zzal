import { NextResponse } from "next/server";
import { db, toPayment } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { getPayProvider } from "@/lib/pay";
import { CREDIT_PACKS, directPrice } from "@/lib/pay/items";
import type { PayCatalog } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 🛒 구매 카탈로그 — 깨기권 팩 + 확정 상품 직접구매 + 최근 결제 */
export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const d = db();
  const provider = getPayProvider();

  const directs = d
    .prepare("SELECT id, name, emoji, brand, value, stock FROM products WHERE active = 1 ORDER BY value ASC")
    .all()
    .map((r) => ({
      productId: String(r.id),
      name: String(r.name),
      emoji: String(r.emoji),
      brand: String(r.brand || ""),
      value: Number(r.value),
      price: directPrice(Number(r.value)),
      soldOut: Number(r.stock) === 0,
    }));

  const recent = d
    .prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5")
    .all(auth.user.id)
    .map(toPayment);

  const payload: PayCatalog = {
    provider: { name: provider.name, mode: provider.mode, ready: provider.isReady() },
    packs: CREDIT_PACKS,
    directs,
    recent,
  };
  return NextResponse.json(payload);
}
