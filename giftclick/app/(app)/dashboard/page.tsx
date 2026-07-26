"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/components/client";
import { EmptyState } from "@/components/ui";
import type { StatsPayload } from "@/lib/types";
import { fmtKRW, fmtNum, relTime } from "@/lib/format";
import { XP_PER_LEVEL, xpIntoLevel, REWARD_STATUS_LABELS } from "@/lib/constants";

function StatCard({ icon, label, value, sub, accent = "text-gold" }: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-black tracking-tight ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs font-bold text-zinc-400">{label}</p>
      {sub && <p className="mt-1 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  READY: "bg-mint/15 text-mint",
  USED: "bg-zinc-500/20 text-zinc-400",
  EXPIRED: "bg-pink/15 text-pink",
};

export default function DashboardPage() {
  const { data, isLoading } = useSWR<StatsPayload>("/api/stats", fetcher);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { user, totals, weekly, streakDays, recentRewards, topWin, leaderboard, egg } = data;
  const weekMax = Math.max(1, ...weekly.map((w) => w.count));
  const xpPct = Math.round((xpIntoLevel(user.xp) / XP_PER_LEVEL) * 100);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header className="card relative overflow-hidden p-6 sm:p-7">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(212,240,52,0.15), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-zinc-400">
              {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
            </p>
            <h1 className="mt-1 font-display text-3xl text-white">
              {user.nickname || user.name}님, 오늘도 <span className="text-gold">럭키</span>하게 🍀
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              지금 {egg.cycle}번째 금계란을 부화시키는 중이에요 · 균열 {Math.round((1 - egg.hp / egg.maxHp) * 100)}% 진행
            </p>
          </div>
          <Link href="/game" className="btn-gold px-6 py-3 text-base">
            🥚 금계란 깨러 가기
          </Link>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="🎫" label="보유 깨기권" value={`${user.credits}개`} sub="매일 자정 5개 충전" />
        <StatCard icon="💰" label="총 당첨 가치" value={fmtKRW(totals.totalValue)} accent="text-neon"
          sub={`사용 가능 ${totals.ready}개 · 사용 완료 ${totals.used}개`} />
        <StatCard icon="🐣" label="부화한 금계란" value={`${totals.eggsHatched}개`} accent="text-violet"
          sub={`누적 터치 ${fmtNum(totals.cracks)}회`} />
        <StatCard icon="🔥" label="연속 출석" value={`${streakDays}일`} accent="text-pink"
          sub={streakDays > 0 ? "연속 기록 유지 중!" : "오늘 첫 터치를 핀으로!"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Weekly chart */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-white">📊 최근 7일 터치 활동</h2>
            <span className="chip bg-card-2 text-zinc-400">총 {weekly.reduce((s, w) => s + w.count, 0)}회</span>
          </div>
          <div className="mt-5 flex h-40 items-end justify-between gap-2.5">
            {weekly.map((w) => (
              <div key={w.day} className="group flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-black text-zinc-500 opacity-0 transition group-hover:opacity-100">
                  {w.count}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    w.label === "오늘" ? "bg-gradient-to-t from-gold-deep to-neon" : "bg-violet/40 group-hover:bg-violet/70"
                  }`}
                  style={{ height: `${Math.max(6, (w.count / weekMax) * 100)}%` }}
                />
                <span className={`text-[10px] font-bold ${w.label === "오늘" ? "text-gold" : "text-zinc-500"}`}>
                  {w.label}
                </span>
              </div>
            ))}
          </div>

          {/* XP progress */}
          <div className="mt-6 rounded-2xl border border-line bg-ink-2/60 p-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-300">레벨 {user.level} 햅티커</span>
              <span className="text-zinc-500">{fmtNum(user.xp)} XP · 다음 레벨까지 {fmtNum(XP_PER_LEVEL - xpIntoLevel(user.xp))}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full bg-gradient-to-r from-violet via-pink to-gold" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Top win + leaderboard */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <h2 className="text-sm font-black text-white">🏆 나의 최고 당첨</h2>
            {topWin ? (
              <div className="mt-4 flex items-center gap-3.5">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/30 to-violet/20 text-3xl">
                  {topWin.emoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{topWin.title}</p>
                  <p className="mt-0.5 font-display text-xl text-gold">{fmtKRW(topWin.value)}</p>
                </div>
                <span className="ml-auto text-2xl">👑</span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">아직 당첨 기록이 없어요. 첫 금계란을 깨보세요!</p>
            )}
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-black text-white">🚀 XP 랭킹</h2>
            <ol className="mt-3 space-y-2">
              {leaderboard.map((l, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                    i === 0 ? "bg-gold/10" : "bg-ink-2/50"
                  }`}
                >
                  <span className="w-5 text-center font-black text-zinc-400">
                    {["🥇", "🥈", "🥉"][i] ?? i + 1}
                  </span>
                  <span className="text-xl">{l.avatar}</span>
                  <span className="flex-1 truncate font-bold text-zinc-200">
                    {l.nickname}
                    {l.nickname === (user.nickname || user.name) && (
                      <span className="ml-1.5 text-[10px] font-black text-gold">나</span>
                    )}
                  </span>
                  <span className="text-xs font-black text-violet">Lv.{l.level}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Recent rewards */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white">🎀 최근 획득한 기프트</h2>
          <Link href="/rewards" className="text-xs font-bold text-violet hover:underline">
            보관함 전체 보기 →
          </Link>
        </div>
        {recentRewards.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              emoji="🥡"
              title="아직 비어있어요"
              description="금계란을 깨면 기프트가 이곳에 차곡차곡 쌓여요."
              action={<Link href="/game" className="btn-gold text-xs">첫 금계란 깨기 🥚</Link>}
            />
          </div>
        ) : (
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {recentRewards.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink-2/50 p-3">
                <span className="text-2xl">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white">{r.title}</p>
                  <p className="text-[11px] font-bold text-gold">{fmtKRW(r.value)}</p>
                </div>
                <span className={`chip ${STATUS_STYLE[r.status]}`}>{REWARD_STATUS_LABELS[r.status]}</span>
                <span className="hidden text-[10px] text-zinc-500 xl:inline">{relTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
