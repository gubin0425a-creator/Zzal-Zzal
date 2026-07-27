import type {
  GiftconGoods,
  GiftconIssueInput,
  GiftconIssueResult,
  GiftconProvider,
} from "./provider";

/**
 * 기프티엘(Giftiel) Open API 실전 클라이언트.
 *
 * 역주: 기프티엘의 실제 엔드포인트/필드명은 파트너 개발자 문서 기준으로
 * 배포 환경에서 확인 후 맞춰야 합니다. 그래서 모든 경로는 env로 오버라이드 가능합니다.
 *
 * 필요한 환경변수:
 *   GIFTCON_PROVIDER=giftiel
 *   GIFTIEL_API_BASE       (예: https://open-api.giftiel.com — 문서상 실제 호스트로 교체)
 *   GIFTIEL_API_KEY        (파트너 API 키)
 *   GIFTIEL_PARTNER_CODE   (파트너/기업 코드)
 * 선택 오버라이드:
 *   GIFTIEL_PATH_GOODS      기본 "/goods/list"
 *   GIFTIEL_PATH_ISSUE      기본 "/gift/coupon/issue"
 *   GIFTIEL_PATH_CANCEL     기본 "/gift/coupon/cancel"
 */

const TIMEOUT_MS = 8000;

export class GiftielProvider implements GiftconProvider {
  name = "기프티엘";
  mode = "live" as const;
  readonly failurePolicy = "failed" as const;

  private base = process.env.GIFTIEL_API_BASE || "https://open-api.giftiel.com";
  private key = process.env.GIFTIEL_API_KEY || "";
  private partner = process.env.GIFTIEL_PARTNER_CODE || "";
  private pathGoods = process.env.GIFTIEL_PATH_GOODS || "/goods/list";
  private pathIssue = process.env.GIFTIEL_PATH_ISSUE || "/gift/coupon/issue";
  private pathCancel = process.env.GIFTIEL_PATH_CANCEL || "/gift/coupon/cancel";

  isReady() {
    return Boolean(this.base && this.key && this.partner);
  }

  private async request(path: string, body: Record<string, unknown>) {
    if (!this.isReady()) {
      throw new Error("기프티엘 연동이 설정되지 않았어요 (.env에 GIFTIEL_API_KEY 등 필요)");
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}${path}`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          // 기프티엘은 파트너 키를 헤더로 전달하는 방식을 사용합니다 (문서 기준 조정)
          "x-api-key": this.key,
          "x-partner-code": this.partner,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (json as any)?.message || (json as any)?.msg || `HTTP ${res.status}`;
        throw new Error(`기프티엘 오류: ${msg}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return json as any;
    } finally {
      clearTimeout(timer);
    }
  }

  async issue(input: GiftconIssueInput): Promise<GiftconIssueResult> {
    const json = await this.request(this.pathIssue, {
      partnerCode: this.partner,
      goodsCode: input.goodsCode ?? undefined,
      goodsName: input.title,
      salePrice: input.value,
      // 우리 시스템의 id를 넘겨 발급사 대사(對査)에 활용
      mbrTrId: input.rewardId,
      callbackUrl: process.env.GIFTIEL_CALLBACK_URL || undefined,
    });

    const trId = String(
      json.trId ?? json.tr_id ?? json.transactionId ?? json.data?.trId ?? "",
    );
    const couponNum = String(
      json.couponNum ?? json.coupon_num ?? json.pincode ?? json.data?.couponNum ?? "",
    );
    if (!trId || !couponNum) {
      throw new Error("기프티엘 발급 응답 형식이 예상과 달라요. 필드 매핑 확인 필요");
    }
    return {
      trId,
      couponNum,
      barcodeUrl: json.barcodeUrl ?? json.barcode_url ?? json.data?.barcodeUrl,
      raw: json,
    };
  }

  async cancel(trId: string): Promise<boolean> {
    try {
      const json = await this.request(this.pathCancel, {
        partnerCode: this.partner,
        trId,
      });
      const result = String(json.result ?? json.code ?? json.status ?? "").toUpperCase();
      return result === "SUCCESS" || result === "OK" || result === "Y" || json.success === true;
    } catch {
      return false;
    }
  }

  async listGoods(): Promise<GiftconGoods[]> {
    const json = await this.request(this.pathGoods, {
      partnerCode: this.partner,
      page: 1,
      size: 100,
    });
    // 다양한 응답 래핑 방어적 파싱
    const list =
      (Array.isArray(json) && json) ||
      json.goods || json.list || json.items || json.data?.goods || json.data || [];
    if (!Array.isArray(list)) {
      throw new Error("기프티엘 상품 목록 응답 형식이 예상과 달라요.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (list as any[])
      .map((g) => ({
        code: String(g.goodsCode ?? g.goods_code ?? g.code ?? g.id ?? ""),
        name: String(g.goodsName ?? g.goods_name ?? g.name ?? ""),
        brand: String(g.brandName ?? g.brand_name ?? g.brand ?? ""),
        price: Number(g.salePrice ?? g.sale_price ?? g.price ?? 0) || 0,
        imageUrl: g.imageUrl ?? g.image_url ?? g.imgUrl,
        raw: g,
      }))
      .filter((g) => g.code && g.name && g.price > 0 && g.price <= 50_000);
  }
}
