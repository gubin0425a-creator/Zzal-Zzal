import { NextResponse } from "next/server";
import { db, getMeta } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { giftconMode } from "@/lib/giftcon";

export const dynamic = "force-dynamic";

/** 연동 상태 카드용: 프로바이더 모드, 준비 여부, 발급 통계, 마지막 동기화 */
export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const { name, mode, ready } = giftconMode();
  const d = db();
  const rows = d.prepare("SELECT status, COUNT(*) c FROM giftcon_issues GROUP BY status").all();
  const count = (s: string) => Number(rows.find((r) => r.status === s)?.c ?? 0);
  const goodsSynced = Number(
    d.prepare("SELECT COUNT(*) c FROM products WHERE provider_code IS NOT NULL").get()?.c ?? 0,
  );

  return NextResponse.json({
    provider: { name, mode, ready },
    lastSyncAt: getMeta("giftcon_last_sync"),
    goodsSynced,
    issues: {
      issued: count("ISSUED"),
      pending: count("PENDING"),
      failed: count("FAILED"),
      canceled: count("CANCELED"),
    },
  });
}
