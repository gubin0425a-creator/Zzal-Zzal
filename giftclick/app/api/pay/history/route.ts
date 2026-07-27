import { NextResponse } from "next/server";
import { db, toPayment } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const rows = db()
    .prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .all(auth.user.id)
    .map(toPayment);
  return NextResponse.json({ payments: rows });
}
