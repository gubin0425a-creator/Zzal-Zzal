import { db, genId, now, toEgg, toProduct } from "./db";
import { DAILY_CREDITS, REWARD_EXPIRY_DAYS } from "./constants";
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

export function ensureEgg(userId: string): EggState {
  const d = db();
  let row = d.prepare("SELECT * FROM egg_states WHERE user_id = ?").get(userId);
  if (!row) {
    const maxHp = newEggMaxHp();
    d.prepare(
      "INSERT INTO egg_states (user_id, hp, max_hp, cycle, total_clicks) VALUES (?, ?, ?, 1, 0)",
    ).run(userId, maxHp, maxHp);
    row = d.prepare("SELECT * FROM egg_states WHERE user_id = ?").get(userId)!;
  }
  return toEgg(row);
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
