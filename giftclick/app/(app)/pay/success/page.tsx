"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/client";
import { Spinner } from "@/components/ui";
import { fmtKRW } from "@/lib/format";
import type { Reward } from "@/lib/types";

function SuccessInner() {
  const params = useSearchParams();
  const [state, setState] = useState<
    { phase: "busy" } | { phase: "done"; credits: number; reward: Reward | null; amount: number; title: string } | { phase: "error"; message: string }
  >({ phase: "busy" });

  useEffect(() => {
    const orderId = params.get("orderId") || "";
    const paymentKey = params.get("paymentKey") || "";
    if (!orderId || !paymentKey) {
      setState({ phase: "error", message: "결제 정보(orderId/paymentKey)가 없어요." });
      return;
    }
    api<{ ok: boolean; credits: number; reward: Reward | null; payment: { amount: number; title: string } }>(
      "/api/pay/confirm",
      { method: "POST", body: { orderId, paymentKey } },
    )
      .then((res) =>
        setState({
          phase: "done",
          credits: res.credits,
          reward: res.reward,
          amount: res.payment.amount,
          title: res.payment.title,
        }),
      )
      .catch((e) =>
        setState({ phase: "error", message: e instanceof Error ? e.message : "승인 확인에 실패했어요." }),
      );
  }, [params]);

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center">
        {state.phase === "busy" && (
          <>
            <Spinner className="mx-auto h-8 w-8" />
            <p className="mt-3 text-sm font-bold text-zinc-300">결제 승인을 확인하고 있어요…</p>
          </>
        )}
        {state.phase === "done" && (
          <>
            <p className="bounce-soft text-6xl">🎉</p>
            <h1 className="mt-3 text-xl font-black text-white">결제 완료!</h1>
            <p className="mt-1 text-sm font-bold text-violet">{state.title}</p>
            <p className="mt-1 font-display text-3xl text-gold">{fmtKRW(state.amount)}</p>
            {state.reward && (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-ink-2 p-4">
                <p className="text-3xl">{state.reward.emoji}</p>
                <p className="mt-1 text-sm font-black text-white">{state.reward.title}</p>
                <p className="mt-1 font-mono text-xs font-bold tracking-wider text-gold">{state.reward.pinCode}</p>
              </div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-2">
              {state.reward ? (
                <Link href="/rewards" className="btn-gold">보관함 🎀</Link>
              ) : (
                <Link href="/game" className="btn-gold">금계란 🥚</Link>
              )}
              <Link href="/shop" className="btn-ghost">충전소 🛒</Link>
            </div>
          </>
        )}
        {state.phase === "error" && (
          <>
            <p className="text-6xl">😢</p>
            <h1 className="mt-3 text-xl font-black text-white">승인 확인 실패</h1>
            <p className="mt-2 text-sm text-zinc-400">{state.message}</p>
            <p className="mt-1 text-xs text-zinc-500">결제가 완료됐다면 내역에서 상태를 확인해 주세요.</p>
            <Link href="/shop" className="btn-gold mt-6 block">충전소로 돌아가기 🛒</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-64 max-w-md rounded-2xl" />}>
      <SuccessInner />
    </Suspense>
  );
}
