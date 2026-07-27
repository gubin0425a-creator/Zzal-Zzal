import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { respawnEgg } from "@/lib/game";
import { EASY_HATCH_MAX_VALUE } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 🐣 이지모드 전환 — 지금 알을 새 알로 교체하면서 난이도 스위치.
 * 이지: HP 3~5 · 해치 풀이 ${EASY_HATCH_MAX_VALUE}원 이하로 제한
 * 노말: HP 6~12 · 전체 풀
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  let body: { easy?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const easy = !!body.easy;
  const egg = respawnEgg(auth.user.id, easy);
  return NextResponse.json({
    ok: true,
    easy,
    egg,
    note: easy
      ? `이지모드 ON — 알이 짧아지고 상품은 ${EASY_HATCH_MAX_VALUE.toLocaleString("ko-KR")}원 이하만 나와요`
      : "노말 모드 — 전체 상품 풀에서 추첨해요",
  });
}
