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
  // 최근 발급 이력과 조인해서 발급사 정보를 함께 반환
  const baseSql = `
    SELECT r.*, i.provider AS issue_provider, i.tr_id AS issue_tr
    FROM rewards r
    LEFT JOIN giftcon_issues i ON i.id = (
      SELECT x.id FROM giftcon_issues x
      WHERE x.reward_id = r.id AND x.status = 'ISSUED'
      ORDER BY x.created_at DESC LIMIT 1
    )`;
  const items = (status && ["READY", "USED", "EXPIRED"].includes(status)
    ? d.prepare(`${baseSql} WHERE r.user_id = ? AND r.status = ? ORDER BY r.created_at DESC`).all(auth.user.id, status)
    : d.prepare(`${baseSql} WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(auth.user.id)
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
