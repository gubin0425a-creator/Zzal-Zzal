"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/components/client";
import { useToast } from "@/components/Toast";
import { ConfirmModal, EmptyState, ListSkeleton } from "@/components/ui";
import type { Crack } from "@/lib/types";
import { fmtKRW, fmtTime, dateLabel } from "@/lib/format";

const PAGE = 30;

interface CracksData {
  items: Crack[];
  total: number;
  hasMore: boolean;
}

export default function HistoryPage() {
  const { push } = useToast();
  const { data, isLoading, mutate } = useSWR<CracksData>("/api/cracks?limit=200", fetcher);
  const [limit, setLimit] = useState(PAGE);
  const [deleting, setDeleting] = useState<Crack | null>(null);
  const [clearAll, setClearAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const visible = items.slice(0, limit);

  // group by day
  const groups: Array<{ label: string; rows: Crack[] }> = [];
  for (const c of visible) {
    const label = dateLabel(c.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.rows.push(c);
    else groups.push({ label, rows: [c] });
  }

  async function removeOne() {
    if (!deleting || busy) return;
    setBusy(true);
    const prev = data;
    mutate(
      (d) => ({ items: (d?.items ?? []).filter((c) => c.id !== deleting.id), total: (d?.total ?? 1) - 1, hasMore: d?.hasMore ?? false }),
      { revalidate: false },
    );
    try {
      await api(`/api/cracks/${deleting.id}`, { method: "DELETE" });
      push("내역 한 줄을 삭제했어요.", "success");
      setDeleting(null);
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "삭제에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAll() {
    if (busy) return;
    setBusy(true);
    const prev = data;
    mutate({ items: [], total: 0, hasMore: false }, { revalidate: false });
    try {
      await api("/api/cracks", { method: "DELETE" });
      push("모든 깨기 내역을 비웠어요. 새 마음으로 도전! 🐣", "success");
      setClearAll(false);
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "삭제에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">🧾 깨기 내역</h1>
          <p className="mt-1 text-sm text-zinc-400">
            총 {data ? `${data.total}번의 터치` : "…"} · 자동/수동 모드 모두 기록돼요
          </p>
        </div>
        {items.length > 0 && (
          <button className="btn-danger text-xs" onClick={() => setClearAll(true)}>
            전체 비우기
          </button>
        )}
      </header>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🪹"
          title="아직 깨기 기록이 없어요"
          description="금계란을 두들기면 모든 터치가 여기에 차곡차곡 쌓여요."
          action={<Link href="/game" className="btn-gold text-xs">첫 터치 하러가기 🥚</Link>}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2.5 text-xs font-black tracking-wide text-zinc-500">{g.label}</h2>
              <ul className="card divide-y divide-line/60 overflow-hidden">
                {g.rows.map((c) => (
                  <li key={c.id} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-card-2/40">
                    <span className="text-lg">{c.hatched ? c.productEmoji ?? "🎉" : "💫"}</span>
                    <div className="min-w-0 flex-1">
                      {c.hatched ? (
                        <p className="truncate text-sm font-black text-white">
                          {c.productName}
                          <span className="ml-2 text-gold">{c.productValue ? fmtKRW(c.productValue) : ""}</span>
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-zinc-400">균염만 갔어요 — 다음 터치 파이팅!</p>
                      )}
                      <p className="text-[11px] text-zinc-500">
                        {fmtTime(c.createdAt)} ·{" "}
                        <span className={c.mode === "AUTO" ? "text-violet" : "text-mint"}>
                          {c.mode === "AUTO" ? "🤖 자동" : "👆 터치"}
                        </span>
                      </p>
                    </div>
                    <span className={`chip ${c.hatched ? "bg-gold/15 text-gold" : "bg-card-2 text-zinc-500"}`}>
                      +{c.xp} XP
                    </span>
                    <button
                      onClick={() => setDeleting(c)}
                      className="cursor-pointer rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-pink/15 hover:text-pink group-hover:opacity-100"
                      aria-label="내역 삭제"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {(items.length > limit || data?.hasMore) && (
            <div className="text-center">
              <button className="btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>
                더 보기 ({Math.min(limit, items.length)} / {data?.total ?? items.length})
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={removeOne}
        loading={busy}
        title="내역을 삭제할까요?"
        message="선택한 깨기 내역 한 줄만 삭제돼요. 획득한 기프트나 XP에는 영향이 없어요."
      />
      <ConfirmModal
        open={clearAll}
        onClose={() => setClearAll(false)}
        onConfirm={removeAll}
        loading={busy}
        title="모든 내역을 비울까요?"
        message="지금까지의 깨기 기록이 모두 삭제돼요. 획득한 기프트와 XP는 그대로 유지됩니다."
        confirmLabel="전체 삭제"
      />
    </div>
  );
}
