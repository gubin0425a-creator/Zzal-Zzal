"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/components/client";
import { useToast } from "@/components/Toast";
import { Modal, ConfirmModal, EmptyState, Spinner, CardSkeleton } from "@/components/ui";
import type { Category, Product } from "@/lib/types";
import { fmtKRW } from "@/lib/format";
import { CATEGORY_LABELS, TIER_LABELS, tierOf, MAX_PRODUCT_VALUE } from "@/lib/constants";

const CATS: Array<Category | "ALL"> = ["ALL", "COFFEE", "FOOD", "CONVENIENCE", "CULTURE", "BEAUTY", "ETC"];
const EMOJI_PRESETS = ["🥤", "☕", "🍰", "🍗", "🍕", "🍔", "🍙", "🏪", "🛒", "💄", "🎬", "📺", "🎵", "🛵", "🎁", "💎"];

const TIER_STYLE: Record<string, string> = {
  COMMON: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  UNCOMMON: "bg-mint/15 text-mint border-mint/40",
  RARE: "bg-violet/15 text-violet border-violet/40",
  LEGENDARY: "bg-gold/20 text-gold border-gold/50",
};

interface FormState {
  id?: string;
  name: string;
  brand: string;
  category: Category;
  description: string;
  emoji: string;
  value: string;
  weight: string;
  stock: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "", brand: "", category: "COFFEE", description: "", emoji: "🎁",
  value: "", weight: "10", stock: "-1", active: true,
};

export default function ProductsPage() {
  const { push } = useToast();
  const { data, isLoading, mutate } = useSWR<{ items: Product[] }>("/api/products", fetcher);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "ALL">("ALL");
  const [modal, setModal] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);

  const totalWeight = useMemo(
    () => items.filter((p) => p.active && p.stock !== 0).reduce((s, p) => s + p.weight, 0),
    [items],
  );

  const filtered = items.filter((p) => {
    if (cat !== "ALL" && p.category !== cat) return false;
    const hay = `${p.name} ${p.brand}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || busy) return;
    setBusy(true);
    const isEdit = !!modal.id;
    const body = {
      name: modal.name, brand: modal.brand, category: modal.category,
      description: modal.description, emoji: modal.emoji,
      value: Number(modal.value), weight: Number(modal.weight),
      stock: Number(modal.stock), active: modal.active,
    };
    const tempId = modal.id ?? `tmp_${Date.now()}`;
    const optimisticItem: Product = {
      id: tempId, name: modal.name, brand: modal.brand, category: modal.category,
      description: modal.description, emoji: modal.emoji || "🎁",
      value: Number(modal.value) || 0, weight: Number(modal.weight) || 10,
      stock: Number(modal.stock), active: modal.active,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const prev = data;

    // optimistic
    mutate(
      { items: isEdit ? items.map((p) => (p.id === modal.id ? { ...p, ...optimisticItem } : p)) : [optimisticItem, ...items] },
      { revalidate: false },
    );
    try {
      if (isEdit) {
        await api(`/api/products/${modal.id}`, { method: "PATCH", body });
        push("상품을 수정했어요 ✏️", "success");
      } else {
        await api("/api/products", { method: "POST", body });
        push("새 상품을 등록했어요 🎁", "success");
      }
      setModal(null);
      mutate();
    } catch (err) {
      mutate(prev, { revalidate: false }); // rollback
      push(err instanceof Error ? err.message : "저장에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    const prev = data;
    mutate({ items: items.map((i) => (i.id === p.id ? { ...i, active: !p.active } : i)) }, { revalidate: false });
    try {
      await api(`/api/products/${p.id}`, { method: "PATCH", body: { active: !p.active } });
      push(p.active ? `"${p.name}" 을(를) 당첨 풀에서 제외했어요.` : `"${p.name}" 을(를) 다시 노출해요.`, "info");
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "변경에 실패했어요.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    const prev = data;
    mutate({ items: items.filter((i) => i.id !== deleting.id) }, { revalidate: false });
    try {
      await api(`/api/products/${deleting.id}`, { method: "DELETE" });
      push(`"${deleting.name}" 을(를) 지웠어요.`, "success");
      setDeleting(null);
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
          <h1 className="page-title">🎁 상품 관리</h1>
          <p className="mt-1 text-sm text-zinc-400">
            금계란에서 터지는 당첨 상품 풀이에요. 가중치가 높을수록 잘 나와요.
          </p>
        </div>
        <button className="btn-gold" onClick={() => setModal({ ...EMPTY_FORM })}>
          ＋ 새 상품 등록
        </button>
      </header>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              cat === c ? "bg-gold text-ink" : "border border-line bg-card-2/50 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {c === "ALL" ? "전체" : CATEGORY_LABELS[c]}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-56">
          <input
            className="input" placeholder="🔍 상품명 · 브랜드 검색"
            value={q} onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} height="h-44" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji={items.length === 0 ? "🎏" : "🔍"}
          title={items.length === 0 ? "아직 상품이 없어요" : "조건에 맞는 상품이 없어요"}
          description={
            items.length === 0
              ? "첫 번째 상품을 등록하면 금계란 당첨 풀에 바로 들어가요."
              : "검색어나 카테고리를 바꿔보세요."
          }
          action={items.length === 0 ? (
            <button className="btn-gold text-xs" onClick={() => setModal({ ...EMPTY_FORM })}>
              ＋ 첫 상품 등록하기
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const prob = p.active && p.stock !== 0 && totalWeight > 0 ? (p.weight / totalWeight) * 100 : 0;
            const tier = tierOf(p.value);
            return (
              <article
                key={p.id}
                className={`card group relative flex flex-col gap-3 p-5 transition hover:border-violet/50 ${
                  p.active ? "" : "opacity-55 saturate-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-2 text-3xl">
                    {p.emoji}
                  </span>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`chip border ${TIER_STYLE[tier]}`}>✦ {TIER_LABELS[tier]}</span>
                    <span className="text-[10px] font-bold text-zinc-500">{CATEGORY_LABELS[p.category]}</span>
                  </div>
                </div>
                <div>
                  <h3 className="truncate text-sm font-black text-white">{p.name}</h3>
                  <p className="truncate text-xs text-zinc-500">{p.brand || "브랜드 없음"}</p>
                </div>
                <div className="flex items-end justify-between">
                  <p className="font-display text-xl text-gold">{fmtKRW(p.value)}</p>
                  <p className="text-[11px] font-bold text-zinc-500">
                    {p.stock === -1 ? "재고 무제한" : `재고 ${p.stock}개`}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                    <span>당첨 확률</span>
                    <span className={prob > 0 ? "text-neon" : ""}>
                      {p.active ? (prob > 0 ? `약 ${prob.toFixed(1)}%` : "품절") : "노출 OFF"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet to-neon"
                      style={{ width: `${Math.min(100, prob * 3)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`cursor-pointer flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${
                      p.active
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : "border-line bg-card-2 text-zinc-400"
                    }`}
                  >
                    {p.active ? "노출 중" : "숨김"}
                  </button>
                  <button
                    className="btn-ghost flex-1 px-2 py-1.5 text-[11px]"
                    onClick={() =>
                      setModal({
                        id: p.id, name: p.name, brand: p.brand, category: p.category,
                        description: p.description, emoji: p.emoji,
                        value: String(p.value), weight: String(p.weight),
                        stock: String(p.stock), active: p.active,
                      })
                    }
                  >
                    ✏️ 수정
                  </button>
                  <button
                    className="btn-danger px-2.5 py-1.5 text-[11px]"
                    onClick={() => setDeleting(p)}
                    aria-label="삭제"
                  >
                    🗑
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* create / edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "상품 수정" : "새 상품 등록"}>
        {modal && (
          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <label className="label">아이콘</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {EMOJI_PRESETS.map((e) => (
                  <button
                    type="button"
                    key={e}
                    onClick={() => setModal({ ...modal, emoji: e })}
                    className={`cursor-pointer rounded-lg p-1.5 text-xl transition ${
                      modal.emoji === e ? "bg-gold/25 ring-1 ring-gold" : "bg-ink-2 hover:bg-card-2"
                    }`}
                  >
                    {e}
                  </button>
                ))}
                <input
                  className="input w-16 text-center"
                  value={modal.emoji}
                  onChange={(e) => setModal({ ...modal, emoji: e.target.value })}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">상품명 *</label>
                <input className="input" required maxLength={60} value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="뿌링클 치킨" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">브랜드</label>
                <input className="input" maxLength={40} value={modal.brand}
                  onChange={(e) => setModal({ ...modal, brand: e.target.value })} placeholder="BHC치킨" />
              </div>
              <div>
                <label className="label">카테고리</label>
                <select className="input cursor-pointer" value={modal.category}
                  onChange={(e) => setModal({ ...modal, category: e.target.value as Category })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">가치 (원) * · 최대 {MAX_PRODUCT_VALUE.toLocaleString()}</label>
                <input className="input" required type="number" min={500} max={MAX_PRODUCT_VALUE} step={100}
                  value={modal.value} onChange={(e) => setModal({ ...modal, value: e.target.value })} placeholder="20000" />
              </div>
              <div>
                <label className="label">당첨 가중치 (0.1~100)</label>
                <input className="input" required type="number" min={0.1} max={100} step={0.1}
                  value={modal.weight} onChange={(e) => setModal({ ...modal, weight: e.target.value })} />
                <p className="mt-1 text-[10px] text-zinc-500">숫자가 클수록 자주 나와요</p>
              </div>
              <div>
                <label className="label">재고 (-1 = 무제한)</label>
                <input className="input" required type="number" min={-1} max={9999} step={1}
                  value={modal.stock} onChange={(e) => setModal({ ...modal, stock: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">한 줄 설명</label>
              <input className="input" maxLength={200} value={modal.description}
                onChange={(e) => setModal({ ...modal, description: e.target.value })} placeholder="치즈 시즈닝 치킨 세트" />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-zinc-300">
              <span
                onClick={() => setModal({ ...modal, active: !modal.active })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${modal.active ? "bg-mint" : "bg-zinc-600"}`}
              >
                <span className={`absolute h-3.5 w-3.5 rounded-full bg-ink transition-all ${modal.active ? "left-[18px]" : "left-[3px]"}`} />
              </span>
              당첨 풀에 바로 노출
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={() => setModal(null)}>취소</button>
              <button type="submit" className="btn-gold" disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />}
                {modal.id ? "수정 저장" : "상품 등록"}
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
        title="상품을 삭제할까요?"
        message={`"${deleting?.name}" 을(를) 삭제하면 당첨 풀에서 완전히 사라져요. 이전 당첨 기록의 상품 연결도 해제됩니다.`}
      />
    </div>
  );
}
