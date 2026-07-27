import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { adsStatus, MOCK_AD_SEC } from "@/lib/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const status = adsStatus(auth.user.id, auth.user.role === "ADMIN");
  return NextResponse.json({ ...status, mockAdSec: MOCK_AD_SEC });
}
