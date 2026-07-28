import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { ensureEgg } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const egg = ensureEgg(auth.user.id);
  return NextResponse.json({ user: auth.user, egg });
}
