import { NextRequest, NextResponse } from "next/server";
import { db, now, toProduct } from "@/lib/db";
import { requireAuth, badRequest } from "@/lib/session";
import { validateProduct } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const d = db();
  const existing = d.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!existing) return badRequest("상품을 찾을 수 없습니다.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }
  const base = toProduct(existing);
  const v = validateProduct(body, {
    name: base.name, brand: base.brand, category: base.category,
    description: base.description, emoji: base.emoji, value: base.value,
    weight: base.weight, stock: base.stock, active: base.active,
  });
  if ("error" in v) return badRequest(v.error);
  const p = v.data;
  d.prepare(
    `UPDATE products SET name = ?, brand = ?, category = ?, description = ?, emoji = ?, value = ?, weight = ?, stock = ?, active = ?, updated_at = ?
     WHERE id = ?`,
  ).run(p.name, p.brand, p.category, p.description, p.emoji, p.value, p.weight, p.stock, p.active ? 1 : 0, now(), id);
  const item = toProduct(d.prepare("SELECT * FROM products WHERE id = ?").get(id));
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const d = db();
  const res = d.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (res.changes === 0) return badRequest("상품을 찾을 수 없습니다.");
  return NextResponse.json({ ok: true });
}
