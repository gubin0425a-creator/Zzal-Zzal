import { NextRequest, NextResponse } from "next/server";
import { db, genId, now, toProduct } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { validateProduct } from "@/lib/validate";
import { badRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const items = db()
    .prepare("SELECT * FROM products ORDER BY active DESC, value DESC, created_at DESC")
    .all()
    .map(toProduct);
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
  const v = validateProduct(body);
  if ("error" in v) return badRequest(v.error);
  const p = v.data;
  const id = genId("prd");
  const t = now();
  db()
    .prepare(
      `INSERT INTO products (id, name, brand, category, description, emoji, value, weight, stock, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, p.name, p.brand, p.category, p.description, p.emoji, p.value, p.weight, p.stock, p.active ? 1 : 0, t, t);
  const item = toProduct(db().prepare("SELECT * FROM products WHERE id = ?").get(id));
  return NextResponse.json({ item }, { status: 201 });
}
