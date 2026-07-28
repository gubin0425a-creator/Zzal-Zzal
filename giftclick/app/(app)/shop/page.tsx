"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { api, fetcher } from "@/components/client";
import { useToast } from "@/components/Toast";
import { Modal, Spinner, EmptyState } from "@/components/ui";
import { fmtKRW, fmtNum, relTime } from "@/lib/format";
import type { CreditPackItem, PayCatalog, Payment, Reward } from "@/lib/types";

declare global {
  interface Window {
    loadTossPayments?: (clientKey: string) => Promise<{
      requestPayment: (
        method: "카드" | "가상계좌" | "계좌이체" | "휴가폰",
        opts: { amount: number; orderId: string; orderName: string; successUrl: string; failUrl: string },
      ) => void;
    }>;
  }
}

const STATUS_CHIP: Record<string, string> = {
  DONE: "bg-mint/15 text-mint",
  READY: "bg-violet/15 text-violet",
  CONFIRMING: "bg-violet/15 text-violet",
  FAILED: "bg-pink/15 text-pink",
  CANCELED: "bg-zinc-500/20 text-zinc-400",
};
const STATUS_LABEL: Record<string, string> = {
  DONE: "완료",
  READY: "결제 대기",
  CONFIRMING: "승인 중",
  FAILED: "실패",
  CANCELED: "취소됨",
};

type CheckoutPhase = "choices" | "processing" | "done" | "error";
interface CheckoutState {
  payment: Payment;
  phase: CheckoutPhase;
  creditsAfter: number | null;
  reward: Reward | null;
  error: string;
}

export default function ShopPage() {
  const { push } = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useSWR<PayCatalog>("/api/pay/catalog", fetcher);
  const [tab, setTab] = useState<"packs" | "direct" | "history">("packs");
  const [orderBusy, setOrderBusy] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);

  async function buy(kind: "PACK" | "DIRECT", code: string) {
    if (orderBusy || !data) return;
    setOrderBusy(code);
    try {
      const res = await api<{ payment: Payment; checkout: { mode: string; toss: { clientKey: string; orderName: string; successUrl: string; failUrl: string } | null } }>(
        "/api/pay/order",
        { method: "POST", body: { kind, code } },
      );
      if (res.checkout.mode === "live" && res.checkout.toss) {
        // 실전: 토스 결제창으로 리다이렉트 (내 결제 수단 선택 → 카드/계좌 등)
        const t = res.checkout.toss;
        await openToss(t.clientKey, {
          amount: res.payment.amount,
          orderId: res.payment.orderId,
          orderName: t.orderName,
          successUrl: t.successUrl,
          failUrl: t.failUrl,
        });
        return;
      }
      setCheckout({ payment: res.payment, phase: "choices", creditsAfter: null, reward: null, error: "" });
    } catch (e) {
      push(e instanceof Error ? e.message : "주문 생성에 실패했어요.", "error");
    } finally {
      setOrderBusy("");
    }
  }

  async function openToss(clientKey: string, props: { amount: number; orderId: string; orderName: string; successUrl: string; failUrl: string }) {
    try {
      if (!window.loadTossPayments) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://js.tosspayments.com/v1";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("토스 스크립트 로드 실패"));
          document.head.appendChild(s);
        });
      }
      const tp = await window.loadTossPayments!(clientKey);
      tp.requestPayment("카드", props);
    } catch (e) {
      push(e instanceof Error ? e.message : "결제창을 열 수 없어요.", "error");
      await mutate();
    }
  }

  async function confirmSandbox() {
    if (!checkout || checkout.phase !== "choices") return;
    setCheckout({ ...checkout, phase: "processing" });
    // 모의 결제 처리 연출
    await new Promise((r) => setTimeout(r, 900));
    try {
      const res = await api<{ ok: boolean; credits: number; reward: Reward | null; warn?: string }>(
        "/api/pay/confirm",
        { method: "POST", body: { orderId: checkout.payment.orderId } },
      );
      setCheckout({
        ...checkout,
        phase: "done",
        creditsAfter: res.credits,
        reward: res.reward,
        error: "",
      });
      await mutate();
      globalMutate("/api/auth/me");
      globalMutate("/api/stats");
      globalMutate((key: unknown) => typeof key === "string" && key.startsWith("/api/rewards"));
      if (res.warn) push(res.warn, "info");
    } catch (e) {
      setCheckout({ ...checkout, phase: "error", error: e instanceof Error ? e.message : "결제 승인에 실패했어요." });
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const modeLive = data.provider.mode === "live" && data.provider.ready;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">🛒 충전소</h1>
          <p className="mt-1 text-sm text-zinc-400">
            깨기권 팩과 확정 상품을 실제 구매할 수 있어요
          </p>
        </div>
        <span className={`chip ${modeLive ? "bg-mint/15 text-mint" : "bg-zinc-500/20 text-zinc-400"}`}>
          {modeLive ? "✅ 실전 결제 (토스페이먼츠)" : "🧪 테스트 결제"}
        </span>
      </header>

      {/* 법/세금 안내 */}
      <div className="card border-gold/25 p-4 text-xs leading-relaxed text-zinc-400">
        <p className="font-black text-gold">⚖️ 유료 결제 전 안내</p>
        <ul className="mt-1.5 space-y-1">
          {modeLive ? (
            <li>· 실전 결제가 연결되어 있어요. 실제 결제액이 부모님/사업자 정산으로 이어집니다.</li>
          ) : (
            <li>· 지금은 <b className="text-zinc-200">테스트 결제</b>라 돈이 빠져나가지 않아요. 실전 전환은 토스페이먼츠 키 설정으로!</li>
          )}
          <li>· 실전 결제는 <b className="text-zinc-200">사업자등록</b>이 필요해요 (쇼핑몰 심사) — 부모님 사업자로 신청하세요.</li>
          <li>· 유료 재화+랜덤 상품 구조는 규제(확률형 아이템 정보공개 등) 검토 대상일 수 있어요. <b className="text-zinc-200">확정 상품 구매 탭이 가장 안전</b>해요.</li>
          <li>· 미성년자 결제 시 보호자(법정대리인) 동의가 필요합니다.</li>
        </ul>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {([["packs", "⚡ 깨기권 팩"], ["direct", "🎁 확정 상품 구매"], ["history", "🧾 결제 내역"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-black transition ${
              tab === id ? "bg-gold text-ink" : "border border-line bg-card-2/60 text-zinc-300 hover:border-gold/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "packs" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {data.packs.map((p) => (
            <PackCard key={p.code} pack={p} busy={orderBusy === p.code} onBuy={() => buy("PACK", p.code)} />
          ))}
        </div>
      )}

      {tab === "direct" && (
        <div>
          <p className="mb-3 text-xs text-zinc-500">
            ✅ 랜덤 없음! 결제하면 <b className="text-zinc-300">그 상품이 즉시 기프트 보관함에 발급</b>돼요 (판매가 = 가치 + 수수료)
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.directs.map((pd) => (
              <div key={pd.productId} className="card flex items-center gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-2 text-2xl">
                  {pd.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">{pd.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    가치 {fmtKRW(pd.value)} · 판매가 <b className="text-gold">{fmtKRW(pd.price)}</b>
                  </p>
                </div>
                <button
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition active:scale-95 ${
                    pd.soldOut ? "cursor-not-allowed bg-zinc-700/40 text-zinc-500" : "cursor-pointer bg-gold text-ink hover:brightness-110"
                  }`}
                  disabled={pd.soldOut || orderBusy === pd.productId}
                  onClick={() => buy("DIRECT", pd.productId)}
                >
                  {orderBusy === pd.productId ? "…" : pd.soldOut ? "품절" : "구매"}
                </button>
              </div>
            ))}
            {data.directs.length === 0 && (
              <EmptyState emoji="🎁" title="판매 중인 상품이 없어요" description="상품 관리에서 상품을 등록해 주세요." />
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <HistorySection />
      )}

      {/* 🧪 샌드박스 결제 모달 */}
      <Modal open={!!checkout} onClose={() => checkout?.phase !== "processing" && setCheckout(null)} title="">
        {checkout && (
          <div className="text-center">
            {checkout.phase === "choices" && (
              <>
                <p className="text-xs font-black tracking-widest text-violet">🧪 테스트 결제 (돈이 빠져나가지 않아요)</p>
                <h2 className="mt-3 text-lg font-black text-white">{checkout.payment.title}</h2>
                <p className="mt-1 font-display text-4xl text-gold">{fmtKRW(checkout.payment.amount)}</p>
                <div className="mt-5 rounded-2xl border border-line bg-ink-2/60 p-4 text-left text-xs leading-relaxed text-zinc-400">
                  <p className="font-black text-zinc-200">테스트 카드</p>
                  <p className="mt-1 font-mono">4111-****-****-1111 · 무한승인</p>
                  <p className="mt-2">실전(토스페이먼츠)에서는 이 단계가 진짜 결제창으로 대첸돼요.</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="btn-gold" onClick={confirmSandbox}>결제하기 💳</button>
                  <button className="btn-ghost" onClick={() => setCheckout(null)}>취소</button>
                </div>
              </>
            )}
            {checkout.phase === "processing" && (
              <div className="py-8">
                <Spinner className="mx-auto h-8 w-8" />
                <p className="mt-3 text-sm font-bold text-zinc-300">결제 승인 중…</p>
                <p className="mt-1 text-xs text-zinc-500">주문 서버가 승인을 확인하고 지급까지 수행해요</p>
              </div>
            )}
            {checkout.phase === "done" && (
              <>
                <p className="bounce-soft text-6xl">🎉</p>
                <h2 className="mt-3 text-lg font-black text-white">결제 완료!</h2>
                <p className="mt-1 text-sm font-bold text-violet">{checkout.payment.title}</p>
                {checkout.reward ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-line bg-ink-2 p-4">
                    <p className="text-3xl">{checkout.reward.emoji}</p>
                    <p className="mt-1 text-sm font-black text-white">{checkout.reward.title}</p>
                    <p className="mt-1 font-mono text-xs font-bold tracking-wider text-gold">{checkout.reward.pinCode}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">기프트 보관함에 저장됐어요</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-300">
                    깨기권이 <b className="text-neon">{fmtNum(checkout.creditsAfter ?? 0)}장</b>이 됐어요 🎫
                  </p>
                )}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {checkout.reward ? (
                    <Link href="/rewards" className="btn-gold" onClick={() => setCheckout(null)}>보관함 열기 🎀</Link>
                  ) : (
                    <Link href="/game" className="btn-gold" onClick={() => setCheckout(null)}>금계란 깨러 🥚</Link>
                  )}
                  <button className="btn-ghost" onClick={() => setCheckout(null)}>계속 쇼핑 🛒</button>
                </div>
              </>
            )}
            {checkout.phase === "error" && (
              <>
                <p className="text-6xl">😢</p>
                <h2 className="mt-3 text-lg font-black text-white">결제 실패</h2>
                <p className="mt-2 text-sm text-zinc-400">{checkout.error}</p>
                <button className="btn-ghost mt-5 w-full" onClick={() => setCheckout(null)}>닫기</button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function PackCard({ pack, busy, onBuy }: { pack: CreditPackItem; busy: boolean; onBuy: () => void }) {
  const per = Math.round(pack.price / (pack.credits + pack.bonus));
  return (
    <div className="card relative overflow-hidden p-5 text-center">
      {pack.tag && (
        <span className="chip absolute right-3 top-3 bg-pink/15 text-pink">{pack.tag}</span>
      )}
      <p className="text-4xl">🎫</p>
      <p className="mt-2 text-base font-black text-white">{pack.title}</p>
      <p className="text-xs font-bold text-violet">
        {pack.credits}장{pack.bonus > 0 ? ` + ${pack.bonus}장 별도` : ""}
      </p>
      <p className="mt-2 font-display text-2xl text-gold">{fmtKRW(pack.price)}</p>
      <p className="text-[10px] text-zinc-500">장당 약 {fmtNum(per)}원</p>
      <button className="btn-gold mt-4 w-full" onClick={onBuy} disabled={busy}>
        {busy ? <Spinner className="h-4 w-4" /> : "구매하기 💳"}
      </button>
    </div>
  );
}

function HistorySection() {
  const { data } = useSWR<{ payments: Payment[] }>("/api/pay/history", fetcher);
  if (!data) return <div className="skeleton h-48 rounded-2xl" />;
  if (data.payments.length === 0) {
    return <EmptyState emoji="🧾" title="결제 내역이 없어요" description="깨기권 팩이나 확정 상품을 구매하면 여기에 표시돼요." />;
  }
  return (
    <ul className="space-y-2.5">
      {data.payments.map((pm) => (
        <li key={pm.id} className="card flex items-center gap-3 p-4">
          <span className="text-xl">{pm.itemKind === "PACK" ? "🎫" : "🎁"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{pm.title}</p>
            <p className="text-[11px] text-zinc-500">
              {pm.orderId} · {pm.method ?? pm.provider} · {relTime(pm.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-gold">{fmtKRW(pm.amount)}</p>
            <span className={`chip mt-1 ${STATUS_CHIP[pm.status]}`}>{STATUS_LABEL[pm.status]}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
