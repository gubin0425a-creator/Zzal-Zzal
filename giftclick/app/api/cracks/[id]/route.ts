import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, badRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const res = db()
    .prepare("DELETE FROM cracks WHERE id = ? AND user_id = ?")
    .run(id, auth.user.id);
  if (res.changes === 0) return badRequest("내역을 찾을 수 없습니다.");
  return NextResponse.json({ ok: true });
}
