import type {
  GiftconGoods,
  GiftconIssueInput,
  GiftconIssueResult,
  GiftconProvider,
} from "./provider";

/**
 * 기프티엘 샌드박스 — 키 없이 로컬에서 실전과 동일한 발급 플로우를 재현합니다.
 * (기프티엘 API의 응답 포맷과 유사한 trId/couponNum 구조를 흉낸 냅니다.)
 *
 * 테스트용 장애 주입: GIFTCON_SANDBOX_FAIL=1 이면 발급이 항상 실패합니다.
 */

function rand(chars: string, n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const NUM = "0123456789";
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class SandboxGiftconProvider implements GiftconProvider {
  name = "기프티엘 샌드박스";
  mode = "sandbox" as const;

  isReady() {
    return true;
  }

  async issue(input: GiftconIssueInput): Promise<GiftconIssueResult> {
    // 발급 지연 재현 (80~180ms)
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 100));

    if (process.env.GIFTCON_SANDBOX_FAIL === "1" || input.value <= 0) {
      throw new Error("샌드박스 발급 실패 시뮬레이션");
    }

    const trId = `SBX${Date.now()}${rand(NUM, 4)}`;
    const couponNum = `9902-${rand(NUM, 4)}-${rand(NUM, 4)}-${rand(NUM, 2)}${rand(ALNUM, 2)}`;
    return {
      trId,
      couponNum,
      barcodeUrl: `https://barcode.sandbox.giftiel.local/${trId}`,
      raw: {
        result: "SUCCESS",
        trId,
        couponNum,
        goodsCode: input.goodsCode ?? "CUSTOM",
        salePrice: input.value,
        msg: "sandbox issued",
      },
    };
  }

  async cancel(trId: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 60));
    return trId.startsWith("SBX");
  }

  async listGoods(): Promise<GiftconGoods[]> {
    await new Promise((r) => setTimeout(r, 50));
    return SANDBOX_GOODS;
  }
}

/** 샌드박스 카탈로그 — 기프티엘 스타일 상품 코드(G####…), 실물 기프티콘 구성 참고 */
export const SANDBOX_GOODS: GiftconGoods[] = [
  { code: "G00010001", name: "아이스 아메리칸오(T)", brand: "스타벅스", price: 4500 },
  { code: "G00010002", name: "카페라떼 그란데 교환권", brand: "이디야", price: 4200 },
  { code: "G00010003", name: "메가커피 2,000원 모바일 쿠폰", brand: "메가MGC커피", price: 2000 },
  { code: "G00010004", name: "딸기생크림 조각케이크", brand: "투썸플레이스", price: 6500 },
  { code: "G00020001", name: "뿌링클+콜라1.25L", brand: "BHC치킨", price: 20000 },
  { code: "G00020002", name: "허니콤보 교환권", brand: "교촌치킨", price: 21000 },
  { code: "G00020003", name: "포테이토 피자(M) 교환권", brand: "도미노피자", price: 25000 },
  { code: "G00020004", name: "싸이버거 세트 교환권", brand: "맘스터치", price: 8500 },
  { code: "G00020005", name: "배달상품권 30,000원", brand: "배달의민족", price: 30000 },
  { code: "G00030001", name: "모바일상품권 5,000원", brand: "CU", price: 5000 },
  { code: "G00030002", name: "모바일상품권 10,000원", brand: "GS25", price: 10000 },
  { code: "G00030003", name: "모바일상품권 3,000원", brand: "이마트24", price: 3000 },
  { code: "G00040001", name: "영화관람권(2D 일반)", brand: "CGV", price: 13000 },
  { code: "G00040002", name: "디지털 구독권 1개월", brand: "넷플릭스", price: 13500 },
  { code: "G00040003", name: "음원 스트리밍 30일권", brand: "멜론", price: 10900 },
  { code: "G00040004", name: "카카오 이모티콘 플러스", brand: "카카오", price: 3900 },
  { code: "G00050001", name: "기프트카드 50,000원", brand: "올리브영", price: 50000 },
  { code: "G00050002", name: "기프트카드 20,000원", brand: "다이소", price: 20000 },
];
