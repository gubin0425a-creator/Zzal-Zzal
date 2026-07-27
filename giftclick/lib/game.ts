import { db, genId, now, toEgg, toProduct } from "./db";
import { DAILY_CREDITS, REWARD_EXPIRY_DAYS, EASY_HATCH_MAX_VALUE } from "./constants";
import { todayKST } from "./format";
import { genPinCode } from "./id";
import type { EggState, Product } from "./types";

/** Lazy daily refill: resets credits to the daily amount once per Korean day. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maybeRefill(userRow: any): any {
  const last = userRow.last_refill ? String(userRow.last_refill).slice(0, 10) : null;
  // refill when the stored date (UTC day of last refill) differs from today (KST)
  const today = todayKST();
  const lastKST = last
    ? new Date(userRow.last_refill).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
    : null;
  if (lastKST !== today) {
    const credits = Math.max(Number(userRow.credits), DAILY_CREDITS);
    db()
      .prepare("UPDATE users SET credits = ?, last_refill = ?, updated_at = ? WHERE id = ?")
      .run(credits, now(), now(), userRow.id);
    return { ...userRow, credits, last_refill: now() };
  }
  return userRow;
}

export function newEggMaxHp(): number {
  return 6 + Math.floor(Math.random() * 7); // 6~12번의 클릭으로 부화
}

export function newEggMaxHpEasy(): number {
  return 3 + Math.floor(Math.random() * 3); // 이지모드: 3~5번
}

/** 알 위에 크게 표시되는 "대표 상품" id (해치 보상은 별개로 가중치 랜덤.
 *  난이도와 같은 풀에서 뽑아 오해를 방지) */
export function pickFeaturedId(maxValue?: number): string | null {
  let pool = drawableProducts();
  if (maxValue !== undefined) {
    const filtered = pool.filter((p) => p.value <= maxValue);
    if (filtered.length > 0) pool = filtered;
  }
  const pick = drawProduct(pool);
  return pick?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function featuredOf(row: any) {
  const pid = row?.featured_product_id;
  if (!pid) return null;
  const p = db()
    .prepare("SELECT name, emoji, value, active FROM products WHERE id = ?")
    .get(pid);
  if (!p || Number(p.active) !== 1) return null;
  return { emoji: String(p.emoji), name: String(p.name), value: Number(p.value) };
}

export function ensureEgg(userId: string): EggState {
  const d = db();
  let row = d.prepare("SELECT * FROM egg_states WHERE user_id = ?").get(userId);
  if (!row) {
    const maxHp = newEggMaxHp();
    d.prepare(
      "INSERT INTO egg_states (user_id, hp, max_hp, cycle, total_clicks, featured_product_id) VALUES (?, ?, ?, 1, 0, ?)",
    ).run(userId, maxHp, maxHp, pickFeaturedId());
    row = d.prepare("SELECT * FROM egg_states WHERE user_id = ?").get(userId)!;
  }
  return { ...toEgg(row), featured: featuredOf(row) };
}

/** 현재 알을 버리고 새 알로 교체 (스왑/난이도 전환 공용). cycle+1, 클릭 누적 유지 */
export function respawnEgg(userId: string, easy: boolean): EggState {
  const maxHp = easy ? newEggMaxHpEasy() : newEggMaxHp();
  db()
    .prepare(
      "UPDATE egg_states SET hp = ?, max_hp = ?, cycle = cycle + 1, easy = ?, featured_product_id = ? WHERE user_id = ?",
    )
    .run(
      maxHp,
      maxHp,
      easy ? 1 : 0,
      pickFeaturedId(easy ? EASY_HATCH_MAX_VALUE : undefined),
      userId,
    );
  return ensureEgg(userId);
}

export function drawableProducts(): Product[] {
  return db()
    .prepare("SELECT * FROM products WHERE active = 1 AND stock != 0")
    .all()
    .map(toProduct);
}

/** Weighted random draw. */
export function drawProduct(products: Product[]): Product | null {
  if (products.length === 0) return null;
  const total = products.reduce((s, p) => s + Math.max(p.weight, 0.01), 0);
  let r = Math.random() * total;
  for (const p of products) {
    r -= Math.max(p.weight, 0.01);
    if (r <= 0) return p;
  }
  return products[products.length - 1];
}

export function issueReward(
  userId: string,
  product: Product | null,
  overrides?: Partial<{ title: string; brand: string; emoji: string; value: number; memo: string }>,
) {
  const t = now();
  const id = genId("rwd");
  const expires = new Date(Date.now() + REWARD_EXPIRY_DAYS * 86_400_000).toISOString();
  db()
    .prepare(
      `INSERT INTO rewards (id, user_id, product_id, title, brand, emoji, value, pin_code, status, memo, expires_at, used_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'READY', ?, ?, NULL, ?, ?)`,
    )
    .run(
      id,
      userId,
      product?.id ?? null,
      overrides?.title ?? product?.name ?? "미스터리 기프트",
      overrides?.brand ?? product?.brand ?? "",
      overrides?.emoji ?? product?.emoji ?? "🎁",
      overrides?.value ?? product?.value ?? 0,
      genPinCode(),
      overrides?.memo ?? "",
      expires,
      t,
      t,
    );
  return db().prepare("SELECT * FROM rewards WHERE id = ?").get(id)!;
}

export function expireStaleRewards(userId: string) {
  const d = db();
  d.prepare(
    `UPDATE rewards SET status = 'EXPIRED', updated_at = ?
     WHERE user_id = ? AND status = 'READY' AND expires_at IS NOT NULL AND expires_at < ?`,
  ).run(now(), userId, now());
}
