/** 결제 프로바이더 인터페이스 — 기프티콘 어댑터와 같은 패턴 */

export interface PayOrderInput {
  orderId: string;
  title: string;
  amount: number;
  userId: string;
  /** 리다이렉트 결제(토스)용 성공/실패 URL — 라우트에서 origin 전달 */
  origin: string;
}

export interface PayCheckoutInfo {
  orderId: string;
  amount: number;
  title: string;
  mode: "sandbox" | "live";
  /** 실전(토스) 결제창에 넘길 데이터. sandbox면 null (앱 내 모의 결제 모달) */
  toss?: {
    clientKey: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  } | null;
}

export interface PayConfirmInput {
  orderId: string;
  amount: number;
  /** PG 결제창이 리다이렉트로 넘긴 paymentKey (toss) */
  paymentKey?: string | null;
}

export type PayConfirmResult =
  | { ok: true; method: string; payKey: string; raw?: unknown }
  | { ok: false; error: string };

export interface PayProvider {
  name: string;
  mode: "sandbox" | "live";
  isReady(): boolean;
  prepare(order: PayOrderInput): Promise<PayCheckoutInfo>;
  confirm(input: PayConfirmInput): Promise<PayConfirmResult>;
}
