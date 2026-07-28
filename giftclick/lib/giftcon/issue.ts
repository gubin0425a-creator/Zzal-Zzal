import { db, genId, now } from "@/lib/db";
import { getGiftconProvider } from "./index";

export type FulfillStatus = "ISSUED" | "PENDING" | "FAILED";

export interface FulfillResult {
  provider: string;
  trId: string | null;
  status: FulfillStatus;
}

/**
 * 당첨/구매 보상(rewardRow)에 대해 발급사 기프티콘 발급 시도.
 * - 발급 성공(쿠폰번호 or 자동송금 완료) → ISSUED + 핀 교체
 * - 실패 → failurePolicy 따라 PENDING(수동 발송 큐) 또는 FAILED
 * crack(부화)과 pay/confirm(확정구매) 양쪽에서 공용 사용.
 */
export async function fulfillGiftconIssue(opts: {
  userId: string;
  rewardRowId: string;
  product: { name: string; value: number; providerCode?: string | null };
  payoutEmail?: string | null;
}): Promise<FulfillResult> {
  const provider = getGiftconProvider();
  const d = db();
  const { userId, rewardRowId, product } = opts;

  try {
    const issued = await provider.issue({
      title: product.name,
      value: product.value,
      goodsCode: product.providerCode ?? null,
      userId,
      rewardId: rewardRowId,
      payoutEmail: opts.payoutEmail ?? null,
    });
    const issueT = now();
    // 쿠폰번호 또는 완결(completed, 자동 송금)이면 즉시 발급(ISSUED),
    // 아니면 수동 발송 모드의 "발송 대기(PENDING)"
    const issueStatus: FulfillStatus = issued.couponNum || issued.completed ? "ISSUED" : "PENDING";
    d.prepare(
      `INSERT INTO giftcon_issues (id, user_id, reward_id, provider, tr_id, coupon_num, status, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      genId("iss"), userId, rewardRowId, provider.name,
      issued.trId, issued.couponNum || null, issueStatus,
      JSON.stringify(issued.raw ?? null), issueT,
    );
    // 발급사가 준 실제 핀코드가 있을 때만 교체 (수동 모드는 발송 완료 시 등록됨)
    if (issued.couponNum) {
      d.prepare("UPDATE rewards SET pin_code = ?, updated_at = ? WHERE id = ?")
        .run(issued.couponNum, issueT, rewardRowId);
    }
    return { provider: provider.name, trId: issued.trId, status: issueStatus };
  } catch (e) {
    const failStatus: FulfillStatus = provider.failurePolicy === "pending" ? "PENDING" : "FAILED";
    d.prepare(
      `INSERT INTO giftcon_issues (id, user_id, reward_id, provider, tr_id, coupon_num, status, raw_json, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    ).run(
      genId("iss"), userId, rewardRowId, provider.name, failStatus,
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), fallback: failStatus }),
      now(),
    );
    return { provider: provider.name, trId: null, status: failStatus };
  }
}
