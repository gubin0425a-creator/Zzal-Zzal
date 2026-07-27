import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { ensureEgg, respawnEgg } from "@/lib/game";

export const dynamic = "force-dynamic";

/** 🔀 알 교체 — 진행 중인 알을 버리고 같은 난이도의 새 알 (균열 진행 초기화) */
export async function POST() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const current = ensureEgg(auth.user.id);
  const egg = respawnEgg(auth.user.id, current.easy);
  return NextResponse.json({ ok: true, egg });
}
