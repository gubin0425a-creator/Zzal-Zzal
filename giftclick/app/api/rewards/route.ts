import { NextRequest, NextResponse } from "next/server";
import { db, now, toReward } from "@/lib/db";
import { requireAuth, badRequest } from "@/lib/session";
import { expireStaleRewards } from "@/lib/game";
import { validateReward } from "@/lib/validate";
import { issueReward } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  expireStaleRewards(auth.user.id);
  const status = new URL(req.url).searchParams.get("status");
  const d = db();
  const items = (status && ["READY", "USED", "EXPIRED"].includes(status)
    ? d.prepare("SELECT * FROM rewards WHERE user_id = ? AND status = ? ORDER BY created_at DESC").all(auth.user.id, status)
    : d.prepare("SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC").all(auth.user.id)
  ).map(toReward);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }
  const v = validateReward(body);
  if ("error" in v) return badRequest(v.error);
  const row = issueReward(auth.user.id, null, v.data);
  if (v.data.status === "USED") {
    db().prepare("UPDATE rewards SET status = 'USED', used_at = ?, updated_at = ? WHERE id = ?")
      .run(now(), now(), (row as { id: string }).id);
  }
  const item = toReward(
    db().prepare("SELECT * FROM rewards WHERE id = ?").get((row as { id: string }).id),
  );
  return NextResponse.json({ item }, { status: 201 });
}
