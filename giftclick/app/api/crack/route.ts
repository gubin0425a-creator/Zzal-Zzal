import { NextRequest, NextResponse } from "next/server";
import { db, genId, now, toReward, toUser } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import {
  ensureEgg, drawableProducts, drawProduct, issueReward, newEggMaxHp,
  newEggMaxHpEasy, pickFeaturedId,
} from "@/lib/game";
import { fulfillGiftconIssue } from "@/lib/giftcon/issue";
import { XP_PER_CLICK, XP_PER_HATCH, BONUS_CREDIT_CHANCE, EASY_HATCH_MAX_VALUE } from "@/lib/constants";
import type { CrackMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  let body: { mode?: CrackMode } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode: CrackMode = body.mode === "AUTO" ? "AUTO" : "MANUAL";
  const userId = auth.user.id;
  const d = db();
  const t = now();

  try {
    d.exec("BEGIN IMMEDIATE");
    // re-read inside tx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = d.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!u) throw Object.assign(new Error("missing user"), { status: 404 });
    if (Number(u.credits) <= 0) throw Object.assign(new Error("깨기권이 모두 소진됐어요. 내일 다시 충전돼요!"), { status: 402 });

    const egg = ensureEgg(userId);
    const crackId = genId("crk");
    let hatched = false;
    let xpGain = XP_PER_CLICK;
    let bonusCredit = Math.random() < BONUS_CREDIT_CHANCE;
    let hp = egg.hp - 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rewardRow: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let wonProduct: any = null;

    if (hp <= 0) {
      // ---- hatch! ----
      hatched = true;
      bonusCredit = false;
      xpGain += XP_PER_HATCH;
      // 이지모드 알: 가치 5,000원 이하 풀에서만 추첨
      const easy = !!egg.easy;
      const all = drawableProducts();
      const pool = easy ? all.filter((p) => p.value <= EASY_HATCH_MAX_VALUE) : all;
      const product = drawProduct(pool.length > 0 ? pool : all);
      wonProduct = product;
      if (product) {
        rewardRow = issueReward(userId, product);
        if (product.stock > 0) {
          d.prepare("UPDATE products SET stock = stock - 1, updated_at = ? WHERE id = ? AND stock > 0")
            .run(t, product.id);
        }
      }
      const maxHp = easy ? newEggMaxHpEasy() : newEggMaxHp();
      d.prepare(
        "UPDATE egg_states SET hp = ?, max_hp = ?, cycle = cycle + 1, total_clicks = total_clicks + 1, featured_product_id = ? WHERE user_id = ?",
      ).run(maxHp, maxHp, pickFeaturedId(easy ? EASY_HATCH_MAX_VALUE : undefined), userId);
      hp = maxHp;
    } else {
      d.prepare("UPDATE egg_states SET hp = ?, total_clicks = total_clicks + 1 WHERE user_id = ?")
        .run(hp, userId);
    }

    const newCredits = Number(u.credits) - 1 + (bonusCredit ? 1 : 0);
    d.prepare("UPDATE users SET credits = ?, xp = xp + ?, updated_at = ? WHERE id = ?")
      .run(newCredits, xpGain, t, userId);

    d.prepare(
      `INSERT INTO cracks (id, user_id, product_id, product_name, product_emoji, product_value, mode, hatched, xp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      crackId, userId, wonProduct?.id ?? null, wonProduct?.name ?? null,
      wonProduct?.emoji ?? null, wonProduct?.value ?? null, mode, hatched ? 1 : 0, xpGain, t,
    );

    d.exec("COMMIT");

    // ---- 기프티콘 발급사 연동 (트랜잭션 커밋 후 외부 호출, 공용 헬퍼) ----
    if (hatched && rewardRow && wonProduct) {
      const issued = await fulfillGiftconIssue({
        userId,
        rewardRowId: (rewardRow as { id: string }).id,
        product: {
          name: wonProduct.name,
          value: wonProduct.value,
          providerCode: wonProduct.providerCode ?? null,
        },
        payoutEmail: u.payout_email ?? null,
      });
      rewardRow = d.prepare("SELECT * FROM rewards WHERE id = ?")
        .get((rewardRow as { id: string }).id)!;
      if (issued.status !== "FAILED") {
        (rewardRow as Record<string, unknown>).issue_provider = issued.provider;
        (rewardRow as Record<string, unknown>).issue_tr = issued.trId;
        (rewardRow as Record<string, unknown>).issue_status = issued.status;
      }
    }

    const eggAfter = ensureEgg(userId);
    const user = toUser(d.prepare("SELECT * FROM users WHERE id = ?").get(userId));
    return NextResponse.json({
      ok: true,
      mode,
      hatched,
      bonusCredit,
      xpGain,
      credits: user.credits,
      xp: user.xp,
      level: user.level,
      egg: eggAfter,
      reward: rewardRow ? toReward(rewardRow) : null,
    });
  } catch (e) {
    try { d.exec("ROLLBACK"); } catch { /* already rolled back */ }
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "일시적인 오류가 발생했어요." },
      { status: err.status ?? 500 },
    );
  }
}
