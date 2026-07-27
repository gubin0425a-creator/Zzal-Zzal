import type {
  PayConfirmInput,
  PayConfirmResult,
  PayOrderInput,
  PayCheckoutInfo,
  PayProvider,
} from "./provider";

/**
 * 결제 샌드박스 — 돈이 실제로 오가지 않는 모의 결제.
 * 토스페이먼츠와 동일한 주문→승인(confirm) 플로우를 재현.
 * PAY_SANDBOX_FAIL=1 이면 승인이 항상 실패 (테스트용).
 */
export class SandboxPayProvider implements PayProvider {
  readonly name = "결제 샌드박스";
  readonly mode = "sandbox" as const;

  isReady() {
    return true;
  }

  async prepare(order: PayOrderInput): Promise<PayCheckoutInfo> {
    return {
      orderId: order.orderId,
      amount: order.amount,
      title: order.title,
      mode: "sandbox",
      toss: null,
    };
  }

  async confirm(input: PayConfirmInput): Promise<PayConfirmResult> {
    if (process.env.PAY_SANDBOX_FAIL === "1") {
      return { ok: false, error: "테스트 결제 실패가 설정되어 있어요 (PAY_SANDBOX_FAIL=1)." };
    }
    return {
      ok: true,
      method: "테스트카드(샌드박스)",
      payKey: `SBXPAY-${input.orderId}`,
      raw: { sandbox: true },
    };
  }
}
