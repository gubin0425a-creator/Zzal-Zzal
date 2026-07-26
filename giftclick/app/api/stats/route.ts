import { NextResponse } from "next/server";
import { db, toReward } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ensureEgg, expireStaleRewards } from "@/lib/game";
import { levelFromXp } from "@/lib/constants";
import type { StatsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

function kstDate(iso: string): { day: string; label: string } {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const label = d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
  return { day, label };
}

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  const uid = auth.user.id;
  const d = db();
  expireStaleRewards(uid);

  const egg = ensureEgg(uid);

  const totalCracks = Number(d.prepare("SELECT COUNT(*) c FROM cracks WHERE user_id = ?").get(uid)?.c ?? 0);
  const hatched = Number(d.prepare("SELECT COUNT(*) c FROM cracks WHERE user_id = ? AND hatched = 1").get(uid)?.c ?? 0);
  const totalValue = Number(
    d.prepare("SELECT COALESCE(SUM(value),0) s FROM rewards WHERE user_id = ?").get(uid)?.s ?? 0,
  );
  const byStatus = d
    .prepare("SELECT status, COUNT(*) c FROM rewards WHERE user_id = ? GROUP BY status")
    .all(uid);
  const count = (s: string) => Number(byStatus.find((r) => r.status === s)?.c ?? 0);
  const productCount = Number(d.prepare("SELECT COUNT(*) c FROM products").get()?.c ?? 0);

  // weekly activity (last 7 days, KST)
  const recentRows = d
    .prepare("SELECT created_at FROM cracks WHERE user_id = ? AND created_at >= ?")
    .all(uid, new Date(Date.now() - 8 * 86_400_000).toISOString());
  const weekly: StatsPayload["weekly"] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000);
    const { day, label } = kstDate(date.toISOString());
    weekly.push({
      day,
      label: i === 0 ? "오늘" : label,
      count: recentRows.filter((r) => kstDate(String(r.created_at)).day === day).length,
    });
  }

  // streak: consecutive KST days with activity ending today/yesterday
  const daySet = new Set(
    d.prepare("SELECT created_at FROM cracks WHERE user_id = ?").all(uid)
      .map((r) => kstDate(String(r.created_at)).day),
  );
  let streakDays = 0;
  for (let i = 0; ; i++) {
    const { day } = kstDate(new Date(Date.now() - i * 86_400_000).toISOString());
    if (daySet.has(day)) streakDays++;
    else if (i === 0) continue; // 오늘 기록이 아직 없으면 어제부터 계산
    else break;
  }

  const recentRewards = d
    .prepare("SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT 5")
    .all(uid)
    .map(toReward);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topWinRaw: any = d
    .prepare("SELECT * FROM rewards WHERE user_id = ? ORDER BY value DESC LIMIT 1")
    .get(uid);

  const leaderboard = d
    .prepare("SELECT nickname, name, avatar, xp FROM users ORDER BY xp DESC LIMIT 5")
    .all()
    .map((r) => ({
      nickname: String(r.nickname || r.name),
      avatar: String(r.avatar || "🐣"),
      xp: Number(r.xp),
      level: levelFromXp(Number(r.xp)),
    }));

  const payload: StatsPayload = {
    user: auth.user,
    egg,
    totals: {
      cracks: totalCracks,
      eggsHatched: hatched,
      totalValue,
      ready: count("READY"),
      used: count("USED"),
      expired: count("EXPIRED"),
      products: productCount,
    },
    streakDays,
    weekly,
    recentRewards,
    topWin: topWinRaw ? toReward(topWinRaw) : null,
    leaderboard,
  };
  return NextResponse.json(payload);
}
