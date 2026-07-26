"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "./client";
import { useToast } from "./Toast";
import { Spinner } from "./ui";
import { relTime } from "@/lib/format";

interface GiftconStatus {
  provider: { name: string; mode: "sandbox" | "live"; ready: boolean };
  lastSyncAt: string | null;
  goodsSynced: number;
  issues: { issued: number; failed: number; canceled: number };
}

export default function GiftconPanel({ onSynced }: { onSynced?: () => void }) {
  const { push } = useToast();
  const { data, error, isLoading, mutate } = useSWR<GiftconStatus>("/api/giftcon/status", fetcher);
  const [busy, setBusy] = useState(false);

  async function sync() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<{ created: number; updated: number; provider: string }>(
        "/api/giftcon/sync",
        { method: "POST" },
      );
      push(`${res.provider} 카탈로그 동기화 완료 — 신규 ${res.created}개 · 갱신 ${res.updated}개`, "success");
      mutate();
      onSynced?.();
    } catch (e) {
      push(e instanceof Error ? e.message : "동기화에 실패했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className="skeleton h-24 rounded-2xl" />;
  if (error || !data) {
    return (
      <div className="card border-pink/40 p-4 text-sm text-pink">
        💥 연동 상태를 불러오지 못했어요.
      </div>
    );
  }

  const { provider, lastSyncAt, goodsSynced, issues } = data;

  return (
    <section className={`card overflow-hidden ${provider.mode === "live" && !provider.ready ? "border-pink/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold/25 to-violet/20 text-2xl">
          🤝
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-white">기프티콘 발급 연동</h3>
            {provider.mode === "sandbox" ? (
              <span className="chip border border-violet/40 bg-violet/15 text-violet">🧪 샌드박스 모드</span>
            ) : provider.ready ? (
              <span className="chip border border-mint/40 bg-mint/15 text-mint">✅ 실전 연동</span>
            ) : (
              <span className="chip border border-pink/40 bg-pink/15 text-pink">⚠️ 키 설정 필요</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {provider.name}
            {goodsSynced > 0 && ` · 카탈로그 상품 ${goodsSynced}개`}
            {lastSyncAt ? ` · 마지막 동기화 ${relTime(lastSyncAt)}` : " · 아직 동기화 전"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden gap-3 text-[11px] font-bold text-zinc-500 sm:flex">
            <span>발급 <b className="text-mint">{issues.issued}</b></span>
            <span>실패 <b className={issues.failed ? "text-pink" : ""}>{issues.failed}</b></span>
            <span>회수 <b className="text-zinc-300">{issues.canceled}</b></span>
          </div>
          <button className="btn-ghost text-xs" onClick={sync} disabled={busy}>
            {busy && <Spinner className="h-3.5 w-3.5" />} 🔄 카탈로그 동기화
          </button>
        </div>
      </div>
      {provider.mode === "live" && !provider.ready && (
        <div className="border-t border-pink/30 bg-pink/10 px-4 py-2.5 text-[11px] font-semibold text-pink sm:px-5">
          실전 모드인데 키가 없어요. <code className="rounded bg-ink px-1 py-0.5">giftclick/.env</code>에
          <b> GIFTIEL_API_KEY</b>, <b>GIFTIEL_PARTNER_CODE</b> 등을 넣고 서버를 재시작하세요.
          그동안은 발급이 실패필드로 기록되고 로컬 핀이 대신 사용됩니다.
        </div>
      )}
      {provider.mode === "sandbox" && (
        <div className="border-t border-line/60 bg-ink-2/40 px-4 py-2 text-[11px] text-zinc-500 sm:px-5">
          💡 샌드박스는 실제 발송 없이 기프티엘과 동일한 발급/회수 플로우를 재현해요.{" "}
          <code className="rounded bg-ink px-1 py-0.5">.env</code>에 <b>GIFTCON_PROVIDER=giftiel</b> + API 키만 넣으면 실전 전환됩니다.
        </div>
      )}
    </section>
  );
}
