import { NextRequest, NextResponse } from "next/server";
import { db, now, toReward } from "@/lib/db";
import { requireAuth, badRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const d = db();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = d.prepare("SELECT * FROM rewards WHERE id = ? AND user_id = ?").get(id, auth.user.id) as any;
  if (!existing) return badRequest("기프트를 찾을 수 없습니다.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 60) return badRequest("기프트 이름은 1~60자로 입력해주세요.");
    d.prepare("UPDATE rewards SET title = ?, updated_at = ? WHERE id = ?").run(title, now(), id);
  }
  if (body.brand !== undefined) {
    d.prepare("UPDATE rewards SET brand = ?, updated_at = ? WHERE id = ?").run(
      String(body.brand).trim().slice(0, 40), now(), id,
    );
  }
  if (body.emoji !== undefined) {
    d.prepare("UPDATE rewards SET emoji = ?, updated_at = ? WHERE id = ?").run(
      String(body.emoji).trim() || "🎁", now(), id,
    );
  }
  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0 || value > 50_000)
      return badRequest("금액은 0 ~ 50,000원 사이여야 합니다.");
    d.prepare("UPDATE rewards SET value = ?, updated_at = ? WHERE id = ?").run(Math.round(value), now(), id);
  }
  if (body.memo !== undefined) {
    const memo = String(body.memo).trim();
    if (memo.length > 200) return badRequest("메모는 200자 이하로 입력해주세요.");
    d.prepare("UPDATE rewards SET memo = ?, updated_at = ? WHERE id = ?").run(memo, now(), id);
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!["READY", "USED"].includes(status)) return badRequest("변경할 수 없는 상태입니다.");
    if (status === "USED") {
      d.prepare("UPDATE rewards SET status = 'USED', used_at = ?, updated_at = ? WHERE id = ?")
        .run(now(), now(), id);
    } else {
      d.prepare("UPDATE rewards SET status = 'READY', used_at = NULL, updated_at = ? WHERE id = ?")
        .run(now(), id);
    }
  }

  const item = toReward(d.prepare("SELECT * FROM rewards WHERE id = ?").get(id));
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const res = db()
    .prepare("DELETE FROM rewards WHERE id = ? AND user_id = ?")
    .run(id, auth.user.id);
  if (res.changes === 0) return badRequest("기프트를 찾을 수 없습니다.");
  return NextResponse.json({ ok: true });
}
