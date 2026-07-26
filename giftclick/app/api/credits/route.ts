import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

const BONUS_AMOUNT = 3;
const COOLDOWN_MS = 30 * 60 * 1000; // 30분 쿨타임

/** 데모용 "미션 보상" 깨기권 충전 — 30분에 한 번 +3개 (최대 10개) */
export async function POST() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const d = db();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = d.prepare("SELECT * FROM users WHERE id = ?").get(auth.user.id) as any;
  const lastBonus = u.last_bonus ? new Date(String(u.last_bonus)).getTime() : 0;
  const remain = COOLDOWN_MS - (Date.now() - lastBonus);
  if (remain > 0) {
    return NextResponse.json(
      { error: `다음 충전까지 ${Math.ceil(remain / 60000)}분 남았어요.` },
      { status: 429 },
    );
  }
  const credits = Math.min(Number(u.credits) + BONUS_AMOUNT, 10);
  d.prepare("UPDATE users SET credits = ?, last_bonus = ?, updated_at = ? WHERE id = ?")
    .run(credits, now(), now(), auth.user.id);
  return NextResponse.json({ ok: true, credits });
}
