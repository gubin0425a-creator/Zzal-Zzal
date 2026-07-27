"use client";

import EggGame from "@/components/EggGame";
import AdRewardCard from "@/components/AdRewardCard";
import AdBanner from "@/components/AdBanner";

export default function GamePage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">🥚 금계란 깨기</h1>
          <p className="mt-1 text-sm text-zinc-400">
            터치마다 XP +10! 알이 부화하면 최대 50,000원 상품이 터져요
          </p>
        </div>
      </header>
      <EggGame />
      <div className="grid gap-4 md:grid-cols-2">
        <AdRewardCard />
        <AdBanner />
      </div>
    </div>
  );
}
