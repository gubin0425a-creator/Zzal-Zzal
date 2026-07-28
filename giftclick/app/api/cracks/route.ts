import { NextRequest, NextResponse } from "next/server";
import { db, toCrack } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  const d = db();
  const total = Number(
    d.prepare("SELECT COUNT(*) AS c FROM cracks WHERE user_id = ?").get(auth.user.id)?.c ?? 0,
  );
  const items = d
    .prepare("SELECT * FROM cracks WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(auth.user.id, limit, offset)
    .map(toCrack);
  return NextResponse.json({ items, total, hasMore: offset + items.length < total });
}

export async function DELETE() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  db().prepare("DELETE FROM cracks WHERE user_id = ?").run(auth.user.id);
  return NextResponse.json({ ok: true });
}
