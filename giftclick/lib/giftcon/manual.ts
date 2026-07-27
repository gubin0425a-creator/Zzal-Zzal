import type {
  GiftconGoods,
  GiftconIssueInput,
  GiftconIssueResult,
  GiftconProvider,
} from "./provider";

/**
 * 수동 발송(직접 전달) 프로바이더 — 사업자 없이 학생 개발자가 실제로 운영할 수 있는 최선의 방식.
 *
 * 당첨이 발생하면 "발송 의무(PENDING)"만 적립하고, 운영자가 카카오톡 선물하기/토스 송금 링크 등으로
 * 직접 전달한 뒤 /fulfillment 콘솔에서 실제 핀/메모를 입력하면 발급이 완료(ISSUED)됩니다.
 */

function rand(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export class ManualFulfillmentProvider implements GiftconProvider {
  name = "수동 발송(직접 전달)";
  mode = "live" as const;
  readonly failurePolicy = "pending" as const;

  isReady() {
    // 별도 키 불필요 — 운영 준비 완료 상태로 항상 표시
    return true;
  }

  async issue(input: GiftconIssueInput): Promise<GiftconIssueResult> {
    const trId = `MAN-${Date.now()}-${rand(4)}`;
    return {
      trId,
      // 쿠폰번호가 비어 있으면 "발송 대기(PENDING)"로 기록되고 로컬 핀이 임시로 유지됩니다.
      couponNum: "",
      raw: { ref: trId, note: "직접 전달 대기", value: input.value, title: input.title },
      completed: false,
    };
  }

  async cancel(trId: string): Promise<boolean> {
    return trId.startsWith("MAN-");
  }

  async listGoods(): Promise<GiftconGoods[]> {
    // 수동 모드는 발급사 카탈로그가 없습니다.
    return [];
  }
}
