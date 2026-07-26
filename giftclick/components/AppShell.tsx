"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ToastProvider, useToast } from "./Toast";
import { api, fetcher } from "./client";
import type { UserPublic } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { XP_PER_LEVEL, xpIntoLevel } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "🏠" },
  { href: "/game", label: "금계란 깨기", icon: "🥚" },
  { href: "/products", label: "상품 관리", icon: "🎁" },
  { href: "/rewards", label: "기프트 보관함", icon: "🎀" },
  { href: "/history", label: "깨기 내역", icon: "🧾" },
  { href: "/profile", label: "내 정보", icon: "👤" },
];

const ADMIN_NAV = { href: "/fulfillment", label: "발송 관리", icon: "📦" };

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="wiggle inline-block text-3xl">🥚</span>
      <span className="font-display text-xl leading-none tracking-tight text-white">
        기프트<span className="text-gold">클릭</span>
      </span>
    </Link>
  );
}

function UserCard({ user }: { user: UserPublic }) {
  const pct = Math.round((xpIntoLevel(user.xp) / XP_PER_LEVEL) * 100);
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-2 text-2xl">
          {user.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">
            {user.nickname || user.name}
            <span className="ml-1.5 rounded-md bg-gold/20 px-1.5 py-0.5 text-[10px] font-black text-gold">
              Lv.{user.level}
            </span>
          </p>
          <p className="truncate text-[11px] text-zinc-400">{user.email}</p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-neon transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-bold text-zinc-500">
        <span>{fmtNum(user.xp)} XP</span>
        <span>다음 레벨까지 {fmtNum(XP_PER_LEVEL - xpIntoLevel(user.xp))} XP</span>
      </div>
    </div>
  );
}

function NavList({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV.slice(0, 5), ADMIN_NAV, NAV[5]] : NAV;
  return (
    <nav className="flex flex-col gap-1">
      {items.map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
              active
                ? "bg-gradient-to-r from-violet/25 to-transparent text-white shadow-[inset_2px_0_0_0_var(--color-gold)]"
                : "text-zinc-400 hover:bg-card-2/70 hover:text-zinc-100"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost w-full text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/auth/logout", { method: "POST" });
          router.replace("/login");
        } catch {
          push("로그아웃에 실패했어요.", "error");
          setBusy(false);
        }
      }}
    >
      🚪 로그아웃
    </button>
  );
}

function Shell({ initialUser, children }: { initialUser: UserPublic; children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { data } = useSWR<{ user: UserPublic }>("/api/auth/me", fetcher, {
    fallbackData: { user: initialUser },
    revalidateOnFocus: true,
  });
  const user = data?.user ?? initialUser;

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 border-r border-line/70 bg-ink-2/70 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2.5">
          <span className="text-xl">🎫</span>
          <div>
            <p className="text-[10px] font-bold text-gold/80">보유 깨기권</p>
            <p className="text-sm font-black text-gold">{user.credits}개</p>
          </div>
          <Link href="/game" className="ml-auto rounded-lg bg-gold px-2.5 py-1.5 text-[11px] font-black text-ink transition hover:brightness-110">
            깨러가기
          </Link>
        </div>
        <NavList isAdmin={user.role === "ADMIN"} />
        <div className="mt-auto space-y-2.5">
          <UserCard user={user} />
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line/70 bg-ink/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <button
          onClick={() => setDrawer(true)}
          className="cursor-pointer rounded-lg p-2 transition hover:bg-card-2"
          aria-label="메뉴 열기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Logo />
        <Link
          href="/game"
          className="ml-auto flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-black text-gold"
        >
          🎫 {user.credits}
        </Link>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
          <div
            className="slide-up flex h-full w-72 flex-col gap-5 border-r border-line bg-ink-2 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setDrawer(false)} className="cursor-pointer p-2 text-zinc-400" aria-label="메뉴 닫기">✕</button>
            </div>
            <NavList onNavigate={() => setDrawer(false)} isAdmin={user.role === "ADMIN"} />
            <div className="mt-auto space-y-2.5">
              <UserCard user={user} />
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      <main className="px-4 pb-16 pt-6 sm:px-8 lg:ml-64 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export default function AppShell({
  initialUser,
  children,
}: {
  initialUser: UserPublic;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <Shell initialUser={initialUser}>{children}</Shell>
    </ToastProvider>
  );
}
