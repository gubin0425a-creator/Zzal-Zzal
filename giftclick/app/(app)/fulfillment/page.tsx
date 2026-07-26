"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/components/client";
import { useToast } from "@/components/Toast";
import { Modal, ConfirmModal, EmptyState, Spinner, ListSkeleton } from "@/components/ui";
import { fmtKRW, relTime } from "@/lib/format";

interface PendingItem {
  id: string;
  trId: string;
  status: string;
  createdAt: string;
  rewardId: string;
  title: string;
  brand: string;
  emoji: string;
  value: number;
  currentPin: string;
  winnerMemo: string;
  winner: { id: string; name: string; avatar: string; email: string };
}

const METHODS = [
  { id: "카카오톡 선물하기", emoji: "💬", desc: "당첨자 카톡ID로 기프티콘 선물 (소액부터 가능)" },
  { id: "토스 송금", emoji: "🅣", desc: "당첨자가 본인 토스앱에서 만든 송금 링크를 카톡으로 받아 전달" },
  { id: "계좌 이체(현금)", emoji: "🏦", desc: "현금 지급 — 사행성 규제 리스크! 소액·자발적 이벤트 범위 권장" },
  { id: "실물/기타", emoji: "📮", desc: "직접 만나 전달하거나 우편 발송" },
] as const;

type MethodId = (typeof METHODS)[number]["id"];

export default function FulfillmentPage() {
  const { push } = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ items: PendingItem[] }>(
    "/api/giftcon/fulfillment",
    fetcher,
  );
  const [ship, setShip] = useState<PendingItem | null>(null);
  const [method, setMethod] = useState<MethodId>("카카오톡 선물하기");
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<PendingItem | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const items = data?.items ?? [];

  async function completeShip() {
    if (!ship || busy) return;
    setBusy(true);
    const body = { issueId: ship.id, method, pin, note };
    // 낙관적 제거
    mutate({ items: items.filter((i) => i.id !== ship.id) }, { revalidate: false });
    try {
      await api("/api/giftcon/fulfillment", { method: "POST", body });
      push(`${ship.winner.name}님 건 발송 완료 처리 🎉 (${method})`, "success");
      setShip(null);
      setPin("");
      setNote("");
    } catch (e) {
      mutate();
      push(e instanceof Error ? e.message : "처리에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!canceling || cancelBusy) return;
    setCancelBusy(true);
    mutate({ items: items.filter((i) => i.id !== canceling.id) }, { revalidate: false });
    try {
      await api(`/api/giftcon/fulfillment?issueId=${canceling.id}`, { method: "DELETE" });
      push("발송 의무를 취소했어요. (당첨자 기프트 항목은 유지됩니다)", "info");
      setCanceling(null);
    } catch (e) {
      mutate();
      push(e instanceof Error ? e.message : "취소에 실패했어요.", "error");
    } finally {
      setCancelBusy(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        emoji="🔒"
        title="관리자 전용 페이지예요"
        description="발송 관리는 ADMIN 계정(admin@giftclick.kr)으로만 볼 수 있어요."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">📦 발송 관리</h1>
        <p className="mt-1 text-sm text-zinc-400">
          수동 발송 모드에서 당첨자에게 직접 전달할 목록이에요. 완료되면 당첨자 핀코드가 실제 쿠폰으로 바뀝니다.
        </p>
      </header>

      {/* 지급 방법 가이드 */}
      <section className="card p-5">
        <h2 className="text-sm font-black text-white">💡 학생 운영자를 위한 지급 방법 가이드</h2>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-400">
          <li className="flex gap-2.5">
            <span className="text-base">💬</span>
            <span>
              <b className="text-zinc-200">카카오톡 선물하기 (추천)</b> — 당첨자가 기프트 메모에 카톡ID를 남기면
              그 ID로 기프티콘을 바로 선물하세요. 사업자 없이 누구나 가능!
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-base">🅣</span>
            <span>

              <b className="text-zinc-200">토스 송금 링크 받기</b> — 당첨자가 토스앱에서 만든 링크를 카톡으로 받아 그 링크로 직접 송금하세요. (링크는 앱에서만 생성돼요)
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-base">🏦</span>
            <span>
              <b className="text-zinc-200">계좌 이체(현금)</b> — 현금 환전은 <b className="text-pink">사행성 규제 리스크</b>가
              있어요. 소액·자발적 이벤트 경품 범위를 지키고, <b className="text-pink">계좌번호는 앱에 저장하지 마세요</b>
              (카톡으로 주고받되 앱에는 메모만 남기기). 애매하면 꼭 부모님과 상의하세요!
            </span>
          </li>
        </ol>
      </section>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🎉"
          title="발송할 게 없어요"
          description="수동 발송 모드에서 당첨이 발생하면 이곳에 발송 대기 목록이 쌓여요."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/25 to-violet/15 text-3xl">
                {it.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-white">{it.title}</p>
                  <span className="chip bg-gold/15 text-gold">{fmtKRW(it.value)}</span>
                  <span className="chip bg-card-2 font-mono text-zinc-500">{it.trId}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  당첨자: <b className="text-zinc-300">{it.winner.avatar} {it.winner.name}</b> ({it.winner.email}) · {relTime(it.createdAt)} 당첨
                </p>
                {it.winnerMemo && (
                  <p className="mt-1.5 rounded-lg bg-ink-2/70 px-3 py-1.5 text-xs text-zinc-400">
                    📨 전달 힌트: {it.winnerMemo}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-danger px-2.5 py-1.5 text-[11px]" onClick={() => setCanceling(it)}>
                  취소
                </button>
                <button className="btn-neon px-3 py-1.5 text-[11px]" onClick={() => { setShip(it); setMethod("카카오톡 선물하기"); setPin(""); setNote(""); }}>
                  발송 처리 →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 발송 처리 모달 */}
      <Modal open={!!ship} onClose={() => setShip(null)} title="발송 완료 처리" wide>
        {ship && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-ink-2/60 p-4 text-sm">
              <p className="font-black text-white">
                {ship.emoji} {ship.title} <span className="ml-1 text-gold">{fmtKRW(ship.value)}</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {ship.winner.avatar} {ship.winner.name} · {ship.winner.email}
              </p>
            </div>

            <div>
              <label className="label">지급 방법</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`cursor-pointer rounded-xl border p-3 text-left transition ${
                      method === m.id ? "border-gold bg-gold/10" : "border-line bg-card-2/50 hover:border-violet/50"
                    }`}
                  >
                    <p className="text-xs font-black text-white">{m.emoji} {m.id}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">실제 쿠폰/핀코드 (선물하기 시)</label>
                <input className="input" value={pin} onChange={(e) => setPin(e.target.value)}
                  placeholder="선물한 상품의 핀 (없으면 비워두기)" />
              </div>
              <div>
                <label className="label">메모 (송금 링크/전달 내용)</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="예: 토스로 5,000원 송금 완료" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShip(null)}>취소</button>
              <button className="btn-gold" onClick={completeShip} disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />} 발송 완료!
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!canceling}
        onClose={() => setCanceling(null)}
        onConfirm={doCancel}
        loading={cancelBusy}
        title="발송을 취소할까요?"
        message={`${canceling?.winner.name}님의 "${canceling?.title}" 발송 무만 해제돼요. 예산이 모자라거나 중복 당첨일 때 쓰세요. (당첨자에게는 기프트 항목이 남아요)`}
        confirmLabel="발송 취소"
      />
    </div>
  );
}
