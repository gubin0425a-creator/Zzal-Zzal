import type {
  GiftconGoods,
  GiftconIssueInput,
  GiftconIssueResult,
  GiftconProvider,
} from "./provider";

/**
 * PayPal Payouts 자동 송금 프로바이더.
 *
 * 최종 꿈의 경로: 당첨 → 당첨자 PayPal 이메일로 자동 송금 → 완료. 운영자 손 안 거침.
 * 단, 전제 조건이 있습니다:
 *   - 부모님 PayPal Business 계정 + PayPal 측의 Payouts 기능 승인(별도 신청)
 *   - 당첨자가 프로필에 자신의 PayPal 이메일 등록 (PayPal 계정은 만 18세+ — 미성년 당첨자는
 *     부모님 계정 이메일 또는 지급 정책 재고 필요)
 *
 * 환경변수:
 *   GIFTCON_PROVIDER=paypal
 *   PAYPAL_ENV=sandbox        (개발 중에는 PayPal 공식 샌드박스에서 습관 테스트)
 *   PAYPAL_CLIENT_ID=...
 *   PAYPAL_CLIENT_SECRET=...
 *   PAYPAL_CURRENCY=USD                     (송금 통화 — KRW는 Payouts 미지원)
 *   PAYPAL_KRW_RATE=1400                    (원화 상품가치 → 송금 통화 환산 비율)
 *   PAYPAL_SENDER_NOTE=GiftClick prize      (송금 메모)
 */

const TIMEOUT_MS = 10_000;

declare global {
  var __GC_PAYPAL_TOKEN: { token: string; expiresAt: number } | undefined;
}

export class PayPalPayoutProvider implements GiftconProvider {
  name = "PayPal 자동 송금";
  mode = "live" as const;
  readonly failurePolicy = "pending" as const; // 자동 송금 실패 → 수동 발송 큐로 넘김

  private env = process.env.PAYPAL_ENV || "sandbox";
  private base =
    this.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  private clientId = process.env.PAYPAL_CLIENT_ID || "";
  private clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
  private currency = process.env.PAYPAL_CURRENCY || "USD";
  private krwRate = Math.max(Number(process.env.PAYPAL_KRW_RATE || 1400), 1);
  private senderNote = process.env.PAYPAL_SENDER_NOTE || "GiftClick prize";

  isReady() {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async request(path: string, init: RequestInit) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}${path}`, { ...init, signal: ctrl.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (json as any)?.message || (json as any)?.error_description || `HTTP ${res.status}`;
        throw new Error(`PayPal 오류: ${msg}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return json as any;
    } finally {
      clearTimeout(timer);
    }
  }

  private async accessToken(): Promise<string> {
    const cached = globalThis.__GC_PAYPAL_TOKEN;
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
    if (!this.isReady()) {
      throw new Error("PayPal 연동이 설정되지 않았어요 (.env에 PAYPAL_CLIENT_ID/SECRET 필요)");
    }
    const json = await this.request("/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const token = String(json.access_token ?? "");
    if (!token) throw new Error("PayPal 액세스 토큰 발급 실패");
    globalThis.__GC_PAYPAL_TOKEN = {
      token,
      expiresAt: Date.now() + Number(json.expires_in ?? 3000) * 1000,
    };
    return token;
  }

  async issue(input: GiftconIssueInput): Promise<GiftconIssueResult> {
    if (!input.payoutEmail) {
      throw new Error("당첨자의 PayPal 이메일이 등록되지 않았어요 (프로필에서 입력하도록 안내)");
    }
    const amountValue = input.value / this.krwRate;
    if (amountValue < 1) {
      throw new Error(
        `금액(${input.value}원)이 PayPal 최소 송금액보다 작아요 — PAYPAL_KRW_RATE/최소금액 조정이 필요합니다`,
      );
    }
    const token = await this.accessToken();
    const json = await this.request("/v1/payments/payouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `GC-${input.rewardId}`.slice(0, 30),
          email_subject: "🎁 기프트클릭 금계란 당첨 송금",
          email_message: `${this.senderNote}: ${input.title}`,
          recipient_type: "EMAIL",
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: { value: amountValue.toFixed(2), currency: this.currency },
            note: input.title,
            sender_item_id: input.rewardId,
            receiver: input.payoutEmail,
          },
        ],
      }),
    });

    const batchId = String(json.batch_header?.payout_batch_id ?? "");
    if (!batchId) throw new Error("PayPal 송금 응답에 배치 ID가 없어요.");
    return {
      trId: batchId,
      // 핀코드 없음 → completed 플래그로 즉시 완결 처리
      couponNum: "",
      completed: true,
      raw: {
        batchId,
        amount: { value: amountValue.toFixed(2), currency: this.currency },
        receiver: input.payoutEmail,
        env: this.env,
      },
    };
  }

  async cancel(): Promise<boolean> {
    // PayPal 송금 배치 취소는 미수령(UNCLAIMED) 아이템만, 개별 아이템 ID로 가능.
    // 대시보드에서 처리하는 것을 권장 — 여기서는 회수 시도를 지원하지 않습니다.
    return false;
  }

  async listGoods(): Promise<GiftconGoods[]> {
    // 현금 송금형 — 상품 카탈로그가 없습니다.
    return [];
  }
}
