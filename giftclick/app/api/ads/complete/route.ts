import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { grantAdReward } from "@/lib/ads";

export const dynamic = "force-dynamic";

/** 광고 시청 완료 보상 지급 — 쿨타임/일일 한도는 서버가 강제 (클리이언트 우회 불가) */
export async function POST() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const result = grantAdReward(auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
