import { NextResponse } from "next/server";
import { db, genId, now, setMeta } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { getGiftconProvider } from "@/lib/giftcon";
import { MAX_PRODUCT_VALUE } from "@/lib/constants";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

function inferCategory(name: string, brand: string): Category {
  const s = `${name} ${brand}`;
  if (/커피|아메리|라떼|스타벅스|이디야|투썸|케이크|메가/i.test(s)) return "COFFEE";
  if (/치킨|피자|버거|김밥|배달|뿌링클|교촌|호떡|식사/i.test(s)) return "FOOD";
  if (/CU|GS25|이마트|세븐일레븐|편의점|모바일상품권/i.test(s)) return "CONVENIENCE";
  if (/영화|CGV|이모티콘|넷플릭스|스트리밍|음원|멜론|구독/i.test(s)) return "CULTURE";
  if (/올리브영|다이소|뷰티|기프트카드/i.test(s)) return "BEAUTY";
  return "ETC";
}

function inferEmoji(category: Category, name: string): string {
  if (/커피|아메리|라떼/.test(name)) return "☕";
  if (/케이크/.test(name)) return "🍰";
  if (/치킨|뿌링클|교촌/.test(name)) return "🍗";
  if (/피자/.test(name)) return "🍕";
  if (/버거/.test(name)) return "🍔";
  if (/배달/.test(name)) return "🛵";
  if (/영화|CGV/.test(name)) return "🎬";
  if (/이모티콘/.test(name)) return "😆";
  if (/넷플릭스|구독/.test(name)) return "📺";
  if (/음원|멜론/.test(name)) return "🎵";
  return { COFFEE: "☕", FOOD: "🍗", CONVENIENCE: "🏪", CULTURE: "🎬", BEAUTY: "💄", ETC: "🎁" }[category];
}

function weightFor(price: number): number {
  if (price <= 3000) return 25;
  if (price <= 6000) return 18;
  if (price <= 11000) return 10;
  if (price <= 25000) return 5;
  return 2;
}

/** 발급사 카탈로그 → 상품 풀 동기화 (provider_code 기준 upsert) */
export async function POST() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const provider = getGiftconProvider();
  const d = db();

  let goods;
  try {
    goods = await provider.listGoods();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "카탈로그 동기화에 실패했어요." },
      { status: 502 },
    );
  }

  const t = now();
  let created = 0;
  let updated = 0;
  for (const g of goods) {
    if (!g.price || g.price > MAX_PRODUCT_VALUE) continue;
    const existing = d.prepare("SELECT * FROM products WHERE provider_code = ?").get(g.code);
    if (existing) {
      d.prepare(
        "UPDATE products SET name = ?, brand = ?, value = ?, updated_at = ? WHERE provider_code = ?",
      ).run(g.name, g.brand, Math.round(g.price), t, g.code);
      updated++;
    } else {
      const category = inferCategory(g.name, g.brand);
      d.prepare(
        `INSERT INTO products (id, name, brand, category, description, emoji, value, weight, stock, active, provider_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, -1, 1, ?, ?, ?)`,
      ).run(
        genId("prd"), g.name, g.brand, category,
        `${provider.name}${provider.mode === "sandbox" ? "(테스트)" : ""} 카탈로그 상품`,
        inferEmoji(category, g.name), Math.round(g.price), weightFor(g.price), g.code, t, t,
      );
      created++;
    }
  }
  setMeta("giftcon_last_sync", t);
  setMeta("giftcon_catalog_count", String(created + updated));

  return NextResponse.json({ ok: true, created, updated, total: created + updated, provider: provider.name });
}
