"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/components/client";
import { useToast } from "@/components/Toast";
import { Modal, ConfirmModal, EmptyState, Spinner } from "@/components/ui";
import type { Reward, RewardStatus } from "@/lib/types";
import { fmtKRW, fmtDate, dDay } from "@/lib/format";
import { MAX_PRODUCT_VALUE } from "@/lib/constants";

type Tab = "ALL" | RewardStatus;
const TABS: Tab[] = ["ALL", "READY", "USED", "EXPIRED"];
const TAB_LABELS: Record<Tab, string> = {
  ALL: "전체",
  READY: "사용 가능",
  USED: "사용 완료",
  EXPIRED: "만료됨",
};

interface EditState {
  id?: string;
  title: string;
  brand: string;
  emoji: string;
  value: string;
  memo: string;
}

export default function RewardsPage() {
  const { push } = useToast();
  const { data, isLoading, mutate } = useSWR<{ items: Reward[] }>("/api/rewards", fetcher);
  const [tab, setTab] = useState<Tab>("ALL");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const counts: Record<Tab, number> = {
    ALL: items.length,
    READY: items.filter((r) => r.status === "READY").length,
    USED: items.filter((r) => r.status === "USED").length,
    EXPIRED: items.filter((r) => r.status === "EXPIRED").length,
  };
  const filtered = tab === "ALL" ? items : items.filter((r) => r.status === tab);
  const usableValue = items.filter((r) => r.status === "READY").reduce((s, r) => s + r.value, 0);

  function optimisticUpdate(id: string, patch: Partial<Reward>) {
    return { items: items.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
  }

  async function setStatus(r: Reward, status: "READY" | "USED") {
    const prev = data;
    mutate(optimisticUpdate(r.id, { status, usedAt: status === "USED" ? new Date().toISOString() : null }), { revalidate: false });
    try {
      await api(`/api/rewards/${r.id}`, { method: "PATCH", body: { status } });
      push(status === "USED" ? "사용 완료 처리했어요 🎉" : "다시 사용 가능 상태로 바꿨어요.", "success");
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "처리에 실패했어요.", "error");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || busy) return;
    setBusy(true);
    const prev = data;
    const body = {
      title: edit.title, brand: edit.brand, emoji: edit.emoji,
      value: Number(edit.value), memo: edit.memo,
    };
    if (edit.id) {
      mutate(optimisticUpdate(edit.id, { title: edit.title, brand: edit.brand, emoji: edit.emoji, value: Number(edit.value) || 0, memo: edit.memo }), { revalidate: false });
    }
    try {
      if (edit.id) {
        await api(`/api/rewards/${edit.id}`, { method: "PATCH", body });
        push("기프트 정보를 수정했어요 ✏️", "success");
      } else {
        await api("/api/rewards", { method: "POST", body });
        push("기프트를 직접 등록했어요 🎀", "success");
      }
      setEdit(null);
      mutate();
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "저장에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    const prev = data;
    mutate({ items: items.filter((r) => r.id !== deleting.id) }, { revalidate: false });
    try {
      await api(`/api/rewards/${deleting.id}`, { method: "DELETE" });
      push("기프트를 삭제했어요.", "success");
      setDeleting(null);
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "삭제에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyPin(pin: string) {
    try {
      await navigator.clipboard.writeText(pin);
      push("핀코드를 복사했어요 📋", "success");
    } catch {
      push("복사에 실패했어요.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">🎀 기프트 보관함</h1>
          <p className="mt-1 text-sm text-zinc-400">
            사용 가능한 기프트 가치: <b className="text-gold">{fmtKRW(usableValue)}</b>
          </p>
        </div>
        <button className="btn-ghost" onClick={() => setEdit({ title: "", brand: "", emoji: "🎁", value: "", memo: "" })}>
          ＋ 직접 등록
        </button>
      </header>

      {/* tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === t ? "bg-gold text-ink" : "border border-line bg-card-2/50 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {TAB_LABELS[t]}
            <span className={`ml-1.5 ${tab === t ? "text-ink/70" : "text-zinc-600"}`}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji={tab === "ALL" ? "🎏" : "🫗"}
          title={tab === "ALL" ? "아직 받은 기프트가 없어요" : `${TAB_LABELS[tab]} 기프트가 없어요`}
          description={tab === "ALL" ? "금계란을 깨면 기프트가 자동으로 이곳에 발급돼요." : "다른 탭을 살펴 보세요."}
          action={tab === "ALL" ? <Link href="/game" className="btn-gold text-xs">금계란 깨러 가기 🥚</Link> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const days = dDay(r.expiresAt);
            const revealed = reveal[r.id];
            return (
              <article
                key={r.id}
                className={`card relative flex flex-col gap-3 overflow-hidden p-5 ${
                  r.status === "EXPIRED" ? "opacity-50 saturate-0" : ""
                }`}
              >
                {r.status !== "READY" && (
                  <span className="pointer-events-none absolute -right-7 top-4 rotate-[35deg] bg-zinc-700/90 px-9 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                    {r.status === "USED" ? "사용됨" : "만료"}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/25 to-violet/15 text-3xl">
                    {r.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{r.title}</p>
                    <p className="text-xs text-zinc-500">{r.brand || "기프트클릭"}</p>
                  </div>
                  <p className="ml-auto font-display text-lg text-gold">{fmtKRW(r.value)}</p>
                </div>

                <button
                  onClick={() => (revealed ? copyPin(r.pinCode) : setReveal((s) => ({ ...s, [r.id]: true })))}
                  className="cursor-pointer rounded-lg border border-dashed border-line bg-ink-2 px-3 py-2 text-center font-mono text-sm font-bold tracking-widest text-zinc-200 transition hover:border-gold/60"
                >
                  {revealed ? `${r.pinCode}  📋` : "👀 눌러서 핀코드 보기"}
                </button>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className={r.provider ? "text-violet" : "text-zinc-600"}>
                    {r.provider ? `🤝 ${r.provider} 발급` : "✍️ 로컬 발급"}
                  </span>
                  {r.providerTr && <span className="font-mono text-zinc-600">TR {r.providerTr.slice(-8)}</span>}
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-zinc-500">{fmtDate(r.expiresAt)} 까지</span>
                  {r.status === "READY" && (
                    <span className={days <= 3 ? "text-pink" : "text-mint"}>
                      {days <= 0 ? "오늘 마감" : `D-${days}`}
                    </span>
                  )}
                  {r.status === "USED" && r.usedAt && <span className="text-zinc-500">{fmtDate(r.usedAt)} 사용</span>}
                </div>

                {r.memo && (
                  <p className="rounded-lg bg-ink-2/70 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                    📝 {r.memo}
                  </p>
                )}

                <div className="mt-auto flex gap-2">
                  {r.status === "READY" && (
                    <button className="btn-neon flex-1 px-2 py-1.5 text-[11px]" onClick={() => setStatus(r, "USED")}>
                      ✔️ 사용 완료 처리
                    </button>
                  )}
                  {r.status === "USED" && (
                    <button className="btn-ghost flex-1 px-2 py-1.5 text-[11px]" onClick={() => setStatus(r, "READY")}>
                      ↩️ 되돌리기
                    </button>
                  )}
                  <button
                    className="btn-ghost px-2 py-1.5 text-[11px]"
                    onClick={() => setEdit({ id: r.id, title: r.title, brand: r.brand, emoji: r.emoji, value: String(r.value), memo: r.memo })}
                  >
                    ✏️
                  </button>
                  <button className="btn-danger px-2.5 py-1.5 text-[11px]" onClick={() => setDeleting(r)} aria-label="삭제">
                    🗑
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* edit / create modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "기프트 수정" : "기프트 직접 등록"}>
        {edit && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-[64px_1fr] gap-3">
              <div>
                <label className="label">아이콘</label>
                <input className="input text-center text-xl" value={edit.emoji} maxLength={4}
                  onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} />
              </div>
              <div>
                <label className="label">기프트 이름 *</label>
                <input className="input" required maxLength={60} value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="스타벅스 아메리칸오" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">브랜드</label>
                <input className="input" maxLength={40} value={edit.brand}
                  onChange={(e) => setEdit({ ...edit, brand: e.target.value })} placeholder="스타벅스" />
              </div>
              <div>
                <label className="label">금액 (원) *</label>
                <input className="input" required type="number" min={0} max={MAX_PRODUCT_VALUE} step={100}
                  value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} placeholder="4500" />
              </div>
            </div>
            <div>
              <label className="label">메모</label>
              <input className="input" maxLength={200} value={edit.memo}
                onChange={(e) => setEdit({ ...edit, memo: e.target.value })} placeholder="예: 금요일 회식 때 쓰기 🎉" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>취소</button>
              <button type="submit" className="btn-gold" disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />} {edit.id ? "저장" : "등록"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="기프트를 삭제할까요?"
        message={`"${deleting?.title}" (${deleting ? fmtKRW(deleting.value) : ""})을(를) 삭제하면 복구할 수 없어요.`}
      />
    </div>
  );
}
