import { NextRequest, NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

function forbidden() {
  return NextResponse.json({ error: "관리자만 접근할 수 있어요." }, { status: 403 });
}

/** 발송 대기(PENDING) 목록 — 관리자 전용 */
export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "ADMIN") return forbidden();

  const rows = db()
    .prepare(
      `SELECT i.id, i.tr_id, i.status, i.created_at,
              r.id AS reward_id, r.title, r.brand, r.emoji, r.value, r.pin_code, r.memo AS winner_memo,
              u.id AS winner_id, u.name AS winner_name, u.nickname AS winner_nickname, u.avatar AS winner_avatar, u.email AS winner_email
       FROM giftcon_issues i
       JOIN rewards r ON r.id = i.reward_id
       JOIN users u ON u.id = i.user_id
       WHERE i.status = 'PENDING'
       ORDER BY i.created_at ASC`,
    )
    .all();

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      trId: r.tr_id,
      status: r.status,
      createdAt: r.created_at,
      rewardId: r.reward_id,
      title: r.title,
      brand: r.brand,
      emoji: r.emoji,
      value: r.value,
      currentPin: r.pin_code,
      winnerMemo: r.winner_memo,
      winner: {
        id: r.winner_id,
        name: r.winner_nickname || r.winner_name,
        avatar: r.winner_avatar,
        email: r.winner_email,
      },
    })),
  });
}

/** 발송 완료 처리: 실제 핀/메모 등록 → ISSUED + 기프트 핀코드 갱신 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "ADMIN") return forbidden();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const issueId = String(body.issueId ?? "");
  const pin = String(body.pin ?? "").trim();
  const note = String(body.note ?? "").trim();
  const method = String(body.method ?? "").trim();
  if (!issueId) return NextResponse.json({ error: "issueId가 필요합니다." }, { status: 400 });

  const d = db();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issue = d.prepare("SELECT * FROM giftcon_issues WHERE id = ? AND status = 'PENDING'").get(issueId) as any;
  if (!issue) return NextResponse.json({ error: "발송 대기 건을 찾을 수 없어요." }, { status: 404 });

  const t = now();
  d.prepare("UPDATE giftcon_issues SET status = 'ISSUED', coupon_num = ?, method = ? WHERE id = ?")
    .run(pin || issue.tr_id, method || null, issueId);
  // 당첨자 메모(전달 힌트)는 유지하면서 발송 기록을 아래에 덧붙임
  const shipLog = `[발송${method ? `: ${method}` : ""}] ${note || "완료"}`.trim();
  const concatSql = `memo = CASE WHEN memo = '' THEN ? ELSE memo || char(10) || ? END`;
  if (pin) {
    d.prepare(`UPDATE rewards SET pin_code = ?, ${concatSql}, updated_at = ? WHERE id = ?`)
      .run(pin, shipLog, shipLog, t, issue.reward_id);
  } else {
    d.prepare(`UPDATE rewards SET ${concatSql}, updated_at = ? WHERE id = ?`)
      .run(shipLog, shipLog, t, issue.reward_id);
  }
  return NextResponse.json({ ok: true });
}

/** 발송 취소 (예산 부족/중복 등) — 관리자 전용 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "ADMIN") return forbidden();

  const issueId = new URL(req.url).searchParams.get("issueId") || "";
  const res = db()
    .prepare("UPDATE giftcon_issues SET status = 'CANCELED' WHERE id = ? AND status = 'PENDING'")
    .run(issueId);
  if (res.changes === 0) return NextResponse.json({ error: "발송 대기 건을 찾을 수 없어요." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
