import { NextRequest, NextResponse } from "next/server";
import { db, genId, now, toReward, toUser } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import {
  ensureEgg, drawableProducts, drawProduct, issueReward, newEggMaxHp,
} from "@/lib/game";
import { getGiftconProvider } from "@/lib/giftcon";
import { XP_PER_CLICK, XP_PER_HATCH, BONUS_CREDIT_CHANCE } from "@/lib/constants";
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
      const product = drawProduct(drawableProducts());
      wonProduct = product;
      if (product) {
        rewardRow = issueReward(userId, product);
        if (product.stock > 0) {
          d.prepare("UPDATE products SET stock = stock - 1, updated_at = ? WHERE id = ? AND stock > 0")
            .run(t, product.id);
        }
      }
      const maxHp = newEggMaxHp();
      d.prepare(
        "UPDATE egg_states SET hp = ?, max_hp = ?, cycle = cycle + 1, total_clicks = total_clicks + 1 WHERE user_id = ?",
      ).run(maxHp, maxHp, userId);
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

    // ---- 기프티콘 발급사 연동 (트랜잭션 커밋 후 외부 호출) ----
    if (hatched && rewardRow && wonProduct) {
      const provider = getGiftconProvider();
      try {
        const issued = await provider.issue({
          title: wonProduct.name,
          value: wonProduct.value,
          goodsCode: wonProduct.providerCode ?? null,
          userId,
          rewardId: (rewardRow as { id: string }).id,
          payoutEmail: u.payout_email ?? null,
        });
        const issueT = now();
        // 쿠폰번호 또는 완결(completed, 자동 송금)이면 즉시 발급(ISSUED),
        // 아니면 수동 발송 모드의 "발송 대기(PENDING)"
        const issueStatus = issued.couponNum || issued.completed ? "ISSUED" : "PENDING";
        d.prepare(
          `INSERT INTO giftcon_issues (id, user_id, reward_id, provider, tr_id, coupon_num, status, raw_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          genId("iss"), userId, (rewardRow as { id: string }).id, provider.name,
          issued.trId, issued.couponNum || null, issueStatus,
          JSON.stringify(issued.raw ?? null), issueT,
        );
        // 발급사가 준 실제 핀코드가 있을 때만 교체 (수동 모드는 발송 완료 시 등록됨)
        if (issued.couponNum) {
          d.prepare("UPDATE rewards SET pin_code = ?, updated_at = ? WHERE id = ?")
            .run(issued.couponNum, issueT, (rewardRow as { id: string }).id);
        }
        rewardRow = d.prepare("SELECT * FROM rewards WHERE id = ?")
          .get((rewardRow as { id: string }).id)!;
        (rewardRow as Record<string, unknown>).issue_provider = provider.name;
        (rewardRow as Record<string, unknown>).issue_tr = issued.trId;
        (rewardRow as Record<string, unknown>).issue_status = issueStatus;
      } catch (e) {
        // 발급 실패 → 프로바이더 정책에 따라 수동 발송 큐(PENDING)로 넘기거나 실패 이력만 기록
        const failStatus = provider.failurePolicy === "pending" ? "PENDING" : "FAILED";
        d.prepare(
          `INSERT INTO giftcon_issues (id, user_id, reward_id, provider, tr_id, coupon_num, status, raw_json, created_at)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        ).run(
          genId("iss"), userId, (rewardRow as { id: string }).id, provider.name, failStatus,
          JSON.stringify({ error: e instanceof Error ? e.message : String(e), fallback: failStatus }), now(),
        );
        if (failStatus === "PENDING") {
          (rewardRow as Record<string, unknown>).issue_provider = provider.name;
          (rewardRow as Record<string, unknown>).issue_status = "PENDING";
        }
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
