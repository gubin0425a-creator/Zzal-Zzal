import { NextRequest, NextResponse } from "next/server";
import { db, now, toPayment, toReward, toUser } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { getPayProvider } from "@/lib/pay";
import { findPack } from "@/lib/pay/items";
import { issueReward } from "@/lib/game";
import { fulfillGiftconIssue } from "@/lib/giftcon/issue";

export const dynamic = "force-dynamic";

/**
 * 결제 승인(confirm) — READY→CONFIRMING 원자 전이로 이중 승인 차단,
 * 승인 후 지급까지. 깨기권 팩=크레딧 즉시, 직접구매=기프트 즉시 발급+발급사 연동.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const uid = auth.user.id;

  let body: { orderId?: string; paymentKey?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const orderId = String(body.orderId || "");
  if (!orderId) return NextResponse.json({ error: "orderId가 없어요." }, { status: 400 });

  const d = db();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pay = d.prepare("SELECT * FROM payments WHERE order_id = ? AND user_id = ?").get(orderId, uid) as any;
  if (!pay) return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  if (pay.status === "DONE") {
    return NextResponse.json({ ok: true, already: true, payment: toPayment(pay) });
  }
  if (pay.status !== "READY") {
    return NextResponse.json({ error: "이미 처리된 주문이에요." }, { status: 409 });
  }

  // 원자 전이 — 동시 클릭/재시도 이중 승인 방지
  const flipped = d.prepare(
    "UPDATE payments SET status = 'CONFIRMING', updated_at = ? WHERE id = ? AND status = 'READY'",
  ).run(now(), pay.id);
  if (flipped.changes !== 1) {
    return NextResponse.json({ error: "이미 처리 중인 주문이에요." }, { status: 409 });
  }

  const provider = getPayProvider();
  const result = await provider.confirm({
    orderId,
    amount: Number(pay.amount),
    paymentKey: body.paymentKey ?? null,
  });

  if (!result.ok) {
    d.prepare("UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ?")
      .run(now(), pay.id);
    return NextResponse.json({ error: result.error }, { status: 402 });
  }

  // ── 지급 ──
  let rewardRow: Record<string, unknown> | null = null;
  let productForIssue: { name: string; value: number; providerCode?: string | null } | null = null;
  let stockWarn: string | null = null;

  d.exec("BEGIN IMMEDIATE");
  try {
    if (pay.item_kind === "PACK") {
      const pack = findPack(String(pay.item_code));
      const total = (pack?.credits ?? 0) + (pack?.bonus ?? 0);
      if (total <= 0) throw new Error("팩 정보를 찾을 수 없어요.");
      d.prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?")
        .run(total, now(), uid);
      d.prepare("UPDATE payments SET credits_granted = ? WHERE id = ?").run(total, pay.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = d.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(String(pay.item_code)) as any;
      if (!p) throw new Error("상품이 더 이상 판매 중이 아니에요.");
      productForIssue = { name: p.name, value: p.value, providerCode: p.provider_code ?? null };
      if (Number(p.stock) > 0) {
        const st = d.prepare("UPDATE products SET stock = stock - 1, updated_at = ? WHERE id = ? AND stock > 0")
          .run(now(), p.id);
        if (st.changes === 0) {
          // 결제 직후 품절 — 실전은 PG 환불 API를 호출해야 함 (이 데모는 지급 진행)
          stockWarn = "결제 직후 품절 — 환불이 필요할 수 있어요.";
        }
      }
      rewardRow = issueReward(uid, null, {
        title: p.name,
        brand: p.brand,
        emoji: p.emoji,
        value: Number(p.value),
        memo: "[직접구매]",
      }) as unknown as Record<string, unknown>;
      d.prepare("UPDATE payments SET reward_id = ? WHERE id = ?")
        .run((rewardRow as { id: string }).id, pay.id);
      // products와 FK를 걸기 위해 product_id 직접 박기
      d.prepare("UPDATE rewards SET product_id = ? WHERE id = ?")
        .run(p.id, (rewardRow as { id: string }).id);
    }
    d.prepare(
      "UPDATE payments SET status = 'DONE', method = ?, pay_key = ?, raw_json = ?, updated_at = ? WHERE id = ?",
    ).run(result.method, result.payKey, JSON.stringify(result.raw ?? null), now(), pay.id);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    d.prepare("UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ?")
      .run(now(), pay.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "지급 처리 중 오류가 발생했어요." },
      { status: 500 },
    );
  }

  // 직접구매는 기프티콘 발급사 연동 (크랙/부화와 동일 경로)
  if (rewardRow && productForIssue) {
    const u = d.prepare("SELECT payout_email FROM users WHERE id = ?").get(uid) as
      | { payout_email: string | null }
      | undefined;
    const issued = await fulfillGiftconIssue({
      userId: uid,
      rewardRowId: (rewardRow as { id: string }).id,
      product: productForIssue,
      payoutEmail: u?.payout_email ?? null,
    });
    rewardRow = d.prepare("SELECT * FROM rewards WHERE id = ?")
      .get((rewardRow as { id: string }).id)! as unknown as Record<string, unknown>;
    if (issued.status !== "FAILED") {
      rewardRow.issue_provider = issued.provider;
      rewardRow.issue_tr = issued.trId;
      rewardRow.issue_status = issued.status;
    }
  }

  const user = toUser(d.prepare("SELECT * FROM users WHERE id = ?").get(uid));
  return NextResponse.json({
    ok: true,
    payment: toPayment(d.prepare("SELECT * FROM payments WHERE id = ?").get(pay.id)),
    credits: user.credits,
    reward: rewardRow ? toReward(rewardRow) : null,
    warn: stockWarn,
  });
}
