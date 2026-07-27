"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, fetcher } from "./client";
import { useToast } from "./Toast";
import { Modal, Spinner } from "./ui";
import { fmtEstWon } from "@/lib/format";
import type { AdCompleteResult, AdsStatus } from "@/lib/types";

/** 샌드박스 테스트 광고 소재 (실제 수익 미발생 — 실전은 NEXT_PUBLIC_ADSENSE_* 설정) */
const MOCK_ADS = [
  { emoji: "🍗", brand: "치킨마을", headline: "신메뉴 황금갈릭치킨 출시!", sub: "지금 주문하면 콜라 1.25L 무료 업그레이드" },
  { emoji: "☕", brand: "카페 모닝", headline: "모닝 커피가 왔다!", sub: "오후 2시 전 아메리카노 990원 이벤트" },
  { emoji: "🎮", brand: "게임브로스", headline: "신작 '달빛기사단' 오늘 오픈", sub: "사전등록 보상 + 레어 무기 선택권 지급 중" },
  { emoji: "🎧", brand: "사운드웨이브", headline: "노이즈 캔슬링 이어폰 50% 특가", sub: "오늘 하루만! 선착순 1,000대 한정" },
  { emoji: "🐱", brand: "냥별마트", headline: "고양이 간식 끝장 세일", sub: "츄르 100개 묶음 구매 시 냥이 장난감 증정" },
  { emoji: "🧀", brand: "문산치즈", headline: "치즈 가득 한입! 치즈볼 2+1", sub: "매일 오전 11시 갓 튀긴 치즈볼" },
];

export default function AdRewardCard() {
  const { push } = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, mutate } = useSWR<AdsStatus>("/api/ads/status", fetcher);

  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(5);
  const [claiming, setClaiming] = useState(false);
  const [cool, setCool] = useState(0);
  const [creative, setCreative] = useState(MOCK_ADS[0]);

  // 서버 쿨타임을 로컬 초 카운터로 이어받기
  useEffect(() => {
    setCool(data?.cooldownRemainSec ?? 0);
  }, [data?.cooldownRemainSec]);
  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  // 테스트 광고 재생 카운트다운
  useEffect(() => {
    if (!open || left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, left]);

  const cap = data?.dailyCap ?? 10;
  const viewsToday = data?.viewsToday ?? 0;
  const exhausted = viewsToday >= cap;
  const ready = !!data && !exhausted && cool <= 0;
  const mockSec = useMemo(() => data?.mockAdSec ?? 5, [data?.mockAdSec]);

  function startAd() {
    if (!ready) return;
    setCreative(MOCK_ADS[Math.floor(Math.random() * MOCK_ADS.length)]);
    setLeft(mockSec);
    setOpen(true);
  }

  async function claim() {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await api<AdCompleteResult>("/api/ads/complete", { method: "POST" });
      push(`광고 시청 완료! 깨기권이 ${res.credits}개가 됐어요 🎫`, "success");
      setOpen(false);
      await mutate();
      globalMutate("/api/auth/me");
      globalMutate("/api/stats");
    } catch (e) {
      push(e instanceof Error ? e.message : "보상 수령에 실패했어요.", "error");
      await mutate();
    } finally {
      setClaiming(false);
    }
  }

  if (!data) {
    return <div className="skeleton h-44 rounded-2xl" />;
  }

  const cta = exhausted
    ? "✅ 오늘 시청 완료"
    : cool > 0
      ? `⏳ ${cool}초 후 다시 가능`
      : `📺 광고 보고 깨기권 +${data.rewardCredits}장`;

  return (
    <div className="card relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(124,108,255,0.18), transparent 70%)" }}
      />
      <div className="relative flex items-center justify-between">
        <h3 className="text-sm font-black text-white">📺 광고 시청 리워드</h3>
        <span
          className={`chip ${
            data.mode === "live" ? "bg-mint/15 text-mint" : "bg-zinc-500/20 text-zinc-400"
          }`}
        >
          {data.mode === "live" ? "✅ 실전 광고" : "🧪 테스트 광고"}
        </span>
      </div>

      <p className="relative mt-1.5 text-xs leading-relaxed text-zinc-400">
        광고 1회 끝까지 시청 → 깨기권 <b className="text-neon">+{data.rewardCredits}장</b> 즉시 지급
        <span className="text-zinc-500"> · 쿨타임 {data.cooldownSec}초 · 하루 {data.dailyCap}회 한도</span>
      </p>

      {/* 오늘 진행도 */}
      <div className="relative mt-3">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-zinc-400">오늘 {viewsToday} / {cap}회 시청</span>
          <span className="text-violet">예상 수익 적립 {fmtEstWon(data.todayEstCents)}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet to-pink transition-all duration-500"
            style={{ width: `${Math.min(100, (viewsToday / cap) * 100)}%` }}
          />
        </div>
      </div>

      <button
        className={`mt-3.5 w-full ${ready ? "btn-gold" : "btn-ghost opacity-70"}`}
        onClick={startAd}
        disabled={!ready}
      >
        {cta}
      </button>

      <div className="relative mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-500">
        <p>내 누적 광고 적립(예상): <b className="text-zinc-300">{fmtEstWon(data.totalEstCents)}</b></p>
        <p>* 견적치(CPM {fmtEstWon(Math.round(data.estPerViewCents * 10))} 기준)예요. 실제 수익/정산은 애드센스에서만 발생해요.</p>
        {data.admin && (
          <p className="rounded-lg border border-gold/25 bg-gold/5 px-2 py-1.5 font-bold text-gold">
            👑 운영 수익 현황 — 오늘 {fmtEstWon(data.admin.todayEstCents)} · 누적 {fmtEstWon(data.admin.totalEstCents)} · 총 시청 {data.admin.totalViews}회
          </p>
        )}
      </div>

      {/* 테스트 광고 모달 */}
      <Modal open={open} onClose={() => (left <= 0 ? setOpen(false) : undefined)} title="">
        <div className="text-center">
          <span className="chip bg-zinc-500/20 text-zinc-400">🧪 테스트 광고 — 실제 수익 미발생</span>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-violet/25 via-ink-2 to-pink/15 p-6">
            <p className="bounce-soft text-6xl">{creative.emoji}</p>
            <p className="mt-2 text-[11px] font-black tracking-widest text-zinc-400">
              {creative.brand} · AD
            </p>
            <h3 className="mt-1 text-lg font-black text-white">{creative.headline}</h3>
            <p className="mt-1 text-xs text-zinc-400">{creative.sub}</p>
            <button className="mt-4 cursor-pointer rounded-xl bg-white/90 px-5 py-2 text-xs font-black text-ink" disabled>
              {creative.brand}에서 자세히 보기 →
            </button>
          </div>

          {left > 0 ? (
            <div className="mt-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet text-xl font-black text-violet">
                {left}
              </div>
              <p className="mt-2 text-xs font-bold text-zinc-400">
                광고를 보는 중이에요… <span className="text-violet">{left}초</span> 후 보상이 열립니다
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon to-gold transition-all duration-1000"
                  style={{ width: `${((mockSec - left) / mockSec) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <button className="btn-gold mt-5 w-full" onClick={claim} disabled={claiming}>
              {claiming ? <Spinner className="h-4 w-4" /> : `🎁 시청 완료! 깨기권 +${data.rewardCredits}장 받기`}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
