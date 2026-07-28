import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGiftconProvider } from "@/lib/giftcon";

export const dynamic = "force-dynamic";

/** 발급사 카탈로그 조회 (프로바이더 명세 그대로 반환) */
export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  try {
    const provider = getGiftconProvider();
    const goods = await provider.listGoods();
    return NextResponse.json({ provider: provider.name, items: goods });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "카탈로그 조회에 실패했어요." },
      { status: 502 },
    );
  }
}
