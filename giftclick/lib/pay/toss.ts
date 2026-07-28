import type {
  PayConfirmInput,
  PayConfirmResult,
  PayOrderInput,
  PayCheckoutInfo,
  PayProvider,
} from "./provider";

/**
 * 토스페이먼츠 실전 어댑터 (결제창 requestPayment + 서버 승인 v1).
 *
 * env:
 *   NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...  (내 상점 클라이언트 키)
 *   TOSS_SECRET_KEY=test_sk_...              (서버 승인용 시크릿, 절대 공개 금지)
 *
 * 흐름: 클라 isBottom -> 결제창 호출 -> successUrl(/pay/success)로
 *        paymentKey/orderId/amount 수신 -> 서버 confirm(여기) -> v1/payments/confirm.
 *
 * 가입: 만18세+ / 사업자 필요 → 부모님 부모님 사업자로 신청 (README 참고)
 */
export class TossPayProvider implements PayProvider {
  readonly name = "토스페이먼츠";
  readonly mode = "live" as const;

  isReady() {
    return !!(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY);
  }

  async prepare(order: PayOrderInput): Promise<PayCheckoutInfo> {
    if (!this.isReady()) {
      throw new Error("토스 키가 설정되지 않았어요 (NEXT_PUBLIC_TOSS_CLIENT_KEY/TOSS_SECRET_KEY).");
    }
    return {
      orderId: order.orderId,
      amount: order.amount,
      title: order.title,
      mode: "live",
      toss: {
        clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!,
        orderName: order.title,
        successUrl: `${order.origin}/pay/success`,
        failUrl: `${order.origin}/pay/fail`,
      },
    };
  }

  async confirm(input: PayConfirmInput): Promise<PayConfirmResult> {
    const secret = process.env.TOSS_SECRET_KEY;
    if (!secret || !input.paymentKey) {
      return { ok: false, error: "시크릿 키 또는 paymentKey가 없어요." };
    }
    const body = {
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    };
    let res: Response;
    try {
      res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch (e) {
      return { ok: false, error: `토스 승인 서버 연결 실패: ${e instanceof Error ? e.message : String(e)}` };
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      /* noop */
    }
    if (!res.ok) {
      const code = String(data.code || res.status);
      const msg = String(data.message || "승인에 실패했어요.");
      return { ok: false, error: `토스 승인 실패 [${code}] ${msg}` };
    }
    return {
      ok: true,
      method: String(data.method || "카드"),
      payKey: String(data.paymentKey || input.paymentKey),
      raw: data,
    };
  }
}
