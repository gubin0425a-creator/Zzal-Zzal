"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { EggArt, Confetti } from "./Egg";
import { api, fetcher } from "./client";
import { useToast } from "./Toast";
import { Modal, Spinner } from "./ui";
import type { EggState, Reward, UserPublic } from "@/lib/types";
import { fmtKRW, fmtNum } from "@/lib/format";
import { tierOf, TIER_LABELS, XP_PER_CLICK } from "@/lib/constants";

interface MeData { user: UserPublic; egg: EggState; }
interface CrackResponse {
  ok: boolean; hatched: boolean; bonusCredit: boolean; xpGain: number;
  credits: number; xp: number; level: number; egg: EggState; reward: Reward | null;
  error?: string;
}

type Floater = { id: number; x: number; label: string };

const TIER_STYLE: Record<string, string> = {
  COMMON: "bg-zinc-500/20 text-zinc-300 border-zinc-400/40",
  UNCOMMON: "bg-mint/15 text-mint border-mint/40",
  RARE: "bg-violet/15 text-violet border-violet/40",
  LEGENDARY: "bg-gold/20 text-gold border-gold/50",
};

export default function EggGame() {
  const { push } = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, mutate } = useSWR<MeData>("/api/auth/me", fetcher);

  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [result, setResult] = useState<Reward | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [swapBusy, setSwapBusy] = useState(false);
  const [easyBusy, setEasyBusy] = useState(false);
  const floaterId = useRef(0);

  const user = data?.user;
  const egg = data?.egg;
  const credits = user?.credits ?? 0;
  const damageRatio = egg ? 1 - egg.hp / egg.maxHp : 0;
  const crackStage = damageRatio <= 0 ? 0 : Math.min(4, 1 + Math.floor(damageRatio * 3.999));

  const addFloater = useCallback((label: string) => {
    const id = ++floaterId.current;
    const x = (Math.random() - 0.5) * 140;
    setFloaters((f) => [...f.slice(-6), { id, x, label }]);
    setTimeout(() => setFloaters((f) => f.filter((i) => i.id !== id)), 950);
  }, []);

  const crack = useCallback(
    async (mode: "MANUAL" | "AUTO") => {
      const current = data;
      if (!current || busy || current.user.credits <= 0) {
        if (current && current.user.credits <= 0) setAuto(false);
        return;
      }
      setBusy(true);
      setShakeKey((k) => k + 1);
      addFloater(`+${XP_PER_CLICK} XP`);

      // optimistic credit tick
      mutate(
        { user: { ...current.user, credits: current.user.credits - 1 }, egg: current.egg },
        { revalidate: false },
      );

      try {
        const res = await api<CrackResponse>("/api/crack", { method: "POST", body: { mode } });
        const fresh: MeData = {
          user: { ...current.user, credits: res.credits, xp: res.xp, level: res.level },
          egg: res.egg,
        };
        mutate(fresh, { revalidate: false });
        globalMutate("/api/stats");

        if (res.hatched) {
          setAuto(false);
          if (res.reward) {
            setResult(res.reward);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2600);
            globalMutate((key: unknown) => typeof key === "string" && key.startsWith("/api/rewards"));
          } else {
            push("금계란이 부화했지만 상품 재고가 없었어요! 다음 알을 노려봐요 🥲", "info");
          }
        } else if (res.bonusCredit) {
          addFloater("🎫 별 포인트 +1!");
          push("반짝 별 출현! 깨기권 1장 별도 지급 ⭐", "success");
        }
      } catch (e) {
        mutate(); // revert optimistic state
        push(e instanceof Error ? e.message : "일시적인 오류가 발생했어요.", "error");
        setAuto(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, data, mutate, addFloater, push, globalMutate],
  );

  // auto mode loop
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      void crack("AUTO");
    }, 700);
    return () => clearInterval(t);
  }, [auto, crack]);

  useEffect(() => {
    if (credits <= 0 && auto) setAuto(false);
  }, [credits, auto]);

  /** 🔀 알 교체 — 진행 중인 균열을 버리고 새 알 */
  async function swapEgg() {
    if (swapBusy || !data) return;
    if (!window.confirm("지금 알을 버리고 새 알로 교체할까요?\n(지금까지의 균열 진행은 사라져요)")) return;
    setSwapBusy(true);
    try {
      const res = await api<{ ok: boolean; egg: EggState }>("/api/egg/swap", { method: "POST" });
      mutate({ user: data.user, egg: res.egg }, { revalidate: false });
      push("새 알을 가져왔어요! 🥚", "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "알 교체에 실패했어요.", "error");
    } finally {
      setSwapBusy(false);
    }
  }

  /** 🐣 이지모드 전환 — 난이도 스위치 + 지금 알 교체 */
  async function changeDifficulty(next: boolean) {
    if (easyBusy || !data) return;
    const msg = next
      ? "🐣 이지모드로 바꿀까요?\n알이 3~5번이면 부화해요. 대신 상품은 5,000원 이하만 나와요!\n(지금 알도 새로 교체해요)"
      : "🔥 노말 모드로 돌아갈까요? 전체 상품 풀(최대 5만 원)이 열립니다!\n(지금 알도 새로 교체해요)";
    if (!window.confirm(msg)) return;
    setEasyBusy(true);
    try {
      const res = await api<{ ok: boolean; egg: EggState; easy: boolean }>(
        "/api/egg/mode",
        { method: "POST", body: { easy: next } },
      );
      mutate({ user: data.user, egg: res.egg }, { revalidate: false });
      push(
        next ? "이지모드 ON! 알이 짧아졌어요 🐣" : "노말 모드! 레전더리도 노려보세요 🔥",
        "success",
      );
    } catch (e) {
      push(e instanceof Error ? e.message : "모드 전환에 실패했어요.", "error");
    } finally {
      setEasyBusy(false);
    }
  }

  async function claimBonus() {
    setBonusBusy(true);
    try {
      const res = await api<{ credits: number }>("/api/credits", { method: "POST" });
      if (data) mutate({ ...data, user: { ...data.user, credits: res.credits } }, { revalidate: false });
      push("미션 보상! 깨기권 3장 충전됐어요 🎫", "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "충전에 실패했어요.", "error");
    } finally {
      setBonusBusy(false);
    }
  }

  async function copyPin(pin: string) {
    try {
      await navigator.clipboard.writeText(pin);
      push("핀코드를 복사했어요 📋", "success");
    } catch {
      push("복사에 실패했어요. 직접 적어두세요!", "error");
    }
  }

  if (!data || !user || !egg) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="skeleton h-[420px] rounded-3xl" />
        <div className="space-y-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="card relative overflow-hidden p-5 sm:p-7">
        {/* backdrop glow */}
        <div
          className="glow-pulse pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(247,201,72,0.28), transparent 65%)" }}
        />

        {/* 상단 바 — 알 교체 · 재화 칩 (벤치마킹 디자인) */}
        <div className="relative flex items-center justify-between gap-2">
          <button
            onClick={() => void swapEgg()}
            disabled={swapBusy}
            className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-xs font-black"
          >
            {swapBusy ? <Spinner className="h-3.5 w-3.5" /> : "🔀"} 알 교체
          </button>
          <div className="flex items-center gap-2">
            <span className="chip border border-violet/40 bg-violet/10 text-violet">⚡ XP {fmtNum(user.xp)}</span>
            <span className="chip border border-gold/40 bg-gold/10 text-gold">💎 깨기권 {credits}</span>
          </div>
        </div>

        {/* 큰 초록 HP pill */}
        <div className="relative mx-auto mt-4 w-full max-w-sm">
          <div className="rounded-2xl bg-gradient-to-r from-emerald-400 to-neon px-4 py-2 shadow-[0_0_28px_rgba(52,211,153,0.35)]">
            <p className="text-center text-sm font-black tracking-tight text-ink">
              알의 HP: {((egg.hp / egg.maxHp) * 100).toFixed(2)}%
              {egg.easy ? " · 🐣 이지" : " · 🔥 노말"}
            </p>
          </div>
        </div>
        <p className="relative mt-3 text-center text-sm font-bold text-zinc-200">
          알을 깨면 보상이 지급됩니다! <span className="text-gold">가즈아🔥</span>
        </p>

        {/* Egg + 대표 상품 오버레이 + 이지모드 스티커 */}
        <div className="relative mx-auto mt-3 flex w-fit flex-col items-center">
          <div className="relative">
            {floaters.map((f) => (
              <span
                key={f.id}
                className="float-up pointer-events-none absolute left-1/2 top-6 z-20 whitespace-nowrap text-sm font-black text-neon"
                style={{ marginLeft: f.x }}
              >
                {f.label}
              </span>
            ))}
            <button
              key={shakeKey}
              onClick={() => void crack("MANUAL")}
              disabled={credits <= 0}
              className={`${shakeKey > 0 ? "egg-shake" : "egg-idle"} relative z-10 block w-56 cursor-pointer transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed sm:w-64`}
              aria-label="금계란 두들기기"
            >
              <EggArt stage={crackStage} className="w-full drop-shadow-[0_18px_36px_rgba(247,201,72,0.25)]" />
              {/* 대표 상품 라벨 (참고 이미지: 알 안에 상품 크게) */}
              <div className="pointer-events-none absolute inset-x-4 top-[28%] z-10 text-center">
                {egg.featured ? (
                  <>
                    <p className="text-2xl leading-none">{egg.featured.emoji}</p>
                    <p className="mt-1 font-display text-sm leading-tight text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.55)] sm:text-base">
                      {egg.featured.name}
                    </p>
                    <p className="font-display text-2xl text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.55)] sm:text-3xl">
                      {fmtKRW(egg.featured.value)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl leading-none">🎁</p>
                    <p className="mt-1 font-display text-lg text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]">
                      미스터리
                    </p>
                  </>
                )}
              </div>
            </button>

            {/* NEW 이지모드 스티커 (참고 이미지 우측 배지) */}
            <div className="absolute -right-3 top-[16%] z-20 rotate-3 sm:-right-8">
              <div className="relative rounded-xl border-2 border-sky-300 bg-white px-2.5 py-2.5 text-center shadow-lg">
                <span className="absolute -top-2.5 right-1 rounded-md bg-pink px-1.5 py-px text-[9px] font-black text-white shadow">
                  NEW
                </span>
                <p className="whitespace-pre-line text-[9px] font-black leading-tight text-ink">
                  {egg.easy ? "알이 짧아요!\n이지모드 중 🐣" : "공격이 힘들 땐?\n이지모드"}
                </p>
                <button
                  onClick={() => void changeDifficulty(!egg.easy)}
                  disabled={easyBusy}
                  className={`mt-1.5 cursor-pointer rounded-lg px-2 py-1 text-[10px] font-black transition active:scale-95 disabled:opacity-50 ${
                    egg.easy ? "bg-zinc-200 text-zinc-700" : "bg-sky-500 text-white"
                  }`}
                >
                  {easyBusy ? "…" : egg.easy ? "노말로" : "켜기"}
                </button>
              </div>
            </div>
          </div>

          {credits <= 0 ? (
            <div className="pop-in relative z-20 mt-4 w-full max-w-sm rounded-2xl border border-line bg-ink-2/90 p-5 text-center">
              <p className="text-lg font-black text-white">깨기권이 모두 떨어졌어요 😢</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                매일 자정(KST)에 깨기권 5장이 자동 충전돼요.
                <br />아래 ⚡ 버튼이나 광고 시청으로 바로 충전할 수도 있어요!
              </p>
              <button className="btn-neon mt-3.5 w-full" onClick={claimBonus} disabled={bonusBusy}>
                {bonusBusy ? <Spinner className="h-4 w-4" /> : "⚡ 미션 보상 받기 (+3장)"}
              </button>
            </div>
          ) : (
            <>
              <p className="relative z-20 mt-3 text-center text-sm font-bold text-zinc-300">
                탭해서 금계란에 균열을 내세요!{" "}
                <span className="text-zinc-500">부화까지 평균 {egg.hp}번 남음</span>
              </p>
              <p className="relative z-20 mt-1 text-center text-[10px] font-bold text-zinc-500">
                🎰 알 안 글자는 대표 상품 장식 — 부화하면 풀에서 무작위로 1개가 나와요
              </p>
            </>
          )}
        </div>

        {/* 하단 액션 타일 (참고 앱의 하단 버튼열) */}
        <div className="relative mx-auto mt-4 grid w-fit grid-cols-3 gap-2.5">
          <button
            onClick={claimBonus}
            disabled={bonusBusy}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-line bg-card-2/60 px-4 py-2.5 transition hover:border-neon/60 active:scale-95 disabled:opacity-50"
          >
            <span className="text-xl">⚡</span>
            <span className="text-[10px] font-bold text-zinc-300">미션 +3장</span>
          </button>
          <Link
            href="/rewards"
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card-2/60 px-4 py-2.5 transition hover:border-gold/60 active:scale-95"
          >
            <span className="text-xl">🎁</span>
            <span className="text-[10px] font-bold text-zinc-300">보관함</span>
          </Link>
          <Link
            href="/history"
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card-2/60 px-4 py-2.5 transition hover:border-violet/60 active:scale-95"
          >
            <span className="text-xl">🧾</span>
            <span className="text-[10px] font-bold text-zinc-300">깨기 내역</span>
          </Link>
        </div>

        {/* progress + auto */}
        <div className="relative mt-5 space-y-3">
          <div className="h-3 overflow-hidden rounded-full border border-line bg-ink-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-neon transition-all duration-300"
              style={{ width: `${Math.round(damageRatio * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => credits > 0 && setAuto((a) => !a)}
              disabled={credits <= 0}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:opacity-40 ${
                auto
                  ? "border-neon/60 bg-neon/15 text-neon"
                  : "border-line bg-card-2/60 text-zinc-300 hover:border-violet/50"
              }`}
            >
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${auto ? "bg-neon" : "bg-zinc-600"}`}>
                <span className={`absolute h-3.5 w-3.5 rounded-full bg-ink transition-all ${auto ? "left-[18px]" : "left-[3px]"}`} />
              </span>
              {auto ? "자동 깨는 중… 🤖" : "자동 깨기 OFF"}
            </button>
            <p className="text-right text-[11px] leading-snug text-zinc-500">
              자동 모드는 0.7초마다
              <br />깨기권 1장을 사용해요
            </p>
          </div>
        </div>
      </section>

      {/* side info */}
      <aside className="space-y-4">
        <div className="card p-5">
          <h3 className="text-sm font-black text-white">🎯 이번 알 정보</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">난이도</dt>
              <dd className={`font-black ${egg.easy ? "text-sky-300" : "text-pink"}`}>
                {egg.easy ? "🐣 이지" : "🔥 노말"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">남은 내구도</dt>
              <dd className="font-black text-gold">{egg.hp} / {egg.maxHp}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">대표 상품</dt>
              <dd className="max-w-[60%] truncate text-right font-bold text-zinc-200">
                {egg.featured
                  ? `${egg.featured.emoji} ${egg.featured.name} (${fmtKRW(egg.featured.value)})`
                  : "🎁 미스터리"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">이 알에 사용한 터치</dt>
              <dd className="font-bold text-zinc-200">{egg.maxHp - egg.hp}회</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">누적 터치</dt>
              <dd className="font-bold text-zinc-200">{egg.totalClicks}회</dd>
            </div>
          </dl>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-black text-white">💡 햅테크 팁</h3>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-zinc-400">
            <li className="flex gap-2"><span>🐣</span> 알은 6~12번 두들기면 부화해요 (이지 3~5번)</li>
            <li className="flex gap-2"><span>🔀</span> 맘에 안 드는 알은 교체로 새 알을 받아요</li>
            <li className="flex gap-2"><span>⭐</span> 8% 확률로 터치 시 깨기권 반사!</li>
            <li className="flex gap-2"><span>🏆</span> 노말 모드에만 5만 원 레전더리가 출현해요</li>
            <li className="flex gap-2"><span>🙌</span> 당첨 기프트는 보관함에 즉시 발급돼요</li>
          </ul>
          <Link href="/products" className="btn-ghost mt-4 w-full text-xs">
            당첨 상품 풀 구경하기 🎁
          </Link>
        </div>
      </aside>

      {showConfetti && <Confetti seedKey={Date.now() % 1000} />}

      {/* Hatch result modal */}
      <Modal open={!!result} onClose={() => setResult(null)} title="">
        {result && (
          <div className="text-center">
            <p className="text-xs font-black tracking-widest text-gold">🎉 GOLDEN EGG HATCHED 🎉</p>
            <div className="bounce-soft mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-gold/30 to-violet/20 text-7xl">
              {result.emoji}
            </div>
            <div className={`chip mx-auto mt-4 border ${TIER_STYLE[tierOf(result.value)]}`}>
              ✦ {TIER_LABELS[tierOf(result.value)]}
            </div>
            <h2 className="mt-2 text-xl font-black text-white">{result.title}</h2>
            {result.brand && <p className="text-sm font-bold text-zinc-400">{result.brand}</p>}
            <p className="mt-3 font-display text-4xl text-gold">{fmtKRW(result.value)}</p>
            <button
              onClick={() => copyPin(result.pinCode)}
              className="mx-auto mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-ink-2 px-4 py-2.5 font-mono text-sm font-bold tracking-wider text-zinc-200 transition hover:border-gold/60"
            >
              {result.pinCode} <span className="text-xs text-zinc-500">📋 복사</span>
            </button>
            <p className="mt-2 text-[11px] text-zinc-500">기프트 보관함에 저장됐어요. 유효기간 내에 사용하세요!</p>
            {result.provider && (
              <p className="mt-1 text-[10px] font-bold text-violet">
                🤝 {result.provider} 발급{result.providerTr ? ` · TR ${result.providerTr.slice(-8)}` : ""}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href="/rewards" className="btn-gold">보관함 열기 🎀</Link>
              <button className="btn-ghost" onClick={() => setResult(null)}>계속 깨기 🥚</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
