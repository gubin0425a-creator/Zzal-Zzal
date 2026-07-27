/**
 * 기프티콘 발급 프로바이더 추상화.
 * - GIFTCON_PROVIDER=sandbox  → 로컬 모의 발급 (키 불필요, 응답 형태는 기프티엘과 동일 포맷)
 * - GIFTCON_PROVIDER=giftiel  → 기프티엘(Giftiel) Open API 실전 발급 (API 키 필요)
 */

export interface GiftconIssueInput {
  title: string;
  value: number;
  /** 프로바이더 쪽 상품 코드(동기화된 상품이면 존재) */
  goodsCode?: string | null;
  userId: string;
  rewardId: string;
  /** PayPal 등 현금 송금형 프로바이더용 수령 이메일 */
  payoutEmail?: string | null;
}

export interface GiftconIssueResult {
  /** 발급사 거래 고유번호 (취소/조회에 사용) */
  trId: string;
  /** 쿠폰 번호(핀코드). 비어 있으면 기프트 핀코드는 로컬 핀 유지 */
  couponNum: string;
  barcodeUrl?: string;
  raw?: unknown;
  /**
   * true면 couponNum이 없어도 즉시 완료(ISSUED) 처리.
   * (PayPal 자동 송금처럼 핀코드 개념이 없는 완결형 발급용)
   */
  completed?: boolean;
}

export interface GiftconGoods {
  code: string;
  name: string;
  brand: string;
  price: number;
  imageUrl?: string;
  raw?: unknown;
}

export interface GiftconProvider {
  /** 표시용 프로바이더 이름 */
  name: string;
  /** 샌드박스 여부 */
  mode: "sandbox" | "live";
  /** 연동 설정이 올바른지 (키 존재 등) */
  isReady(): boolean;
  /**
   * 발급 호출 실패(네트워크/키 미설정/정책) 시 처리 정책:
   * - "pending": 수동 발송 큐로 넘겨 운영자가 후속 처리 (자동 송금형에 적합)
   * - "failed" : 실패 이력만 남기고 로컬 핀 유지 (쿠폰 발급형에 적합)
   */
  readonly failurePolicy: "pending" | "failed";
  /** 쿠폰/기프티콘 발급 */
  issue(input: GiftconIssueInput): Promise<GiftconIssueResult>;
  /** 발급 취소(회수). 실패필드는 false 반환으로 처리 */
  cancel(trId: string): Promise<boolean>;
  /** 판매 상품(상품권) 카탈로그 조회 */
  listGoods(): Promise<GiftconGoods[]>;
}
