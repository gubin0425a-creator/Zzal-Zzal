"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
const SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "";

/**
 * 디스플레이 광고 자리.
 * - NEXT_PUBLIC_ADSENSE_CLIENT / SLOT 설정 시 → 실제 Google AdSense 광고가 나가고
 *   그 수익은 애드센스에 연결된 정산 계좌(부모님 명의, 만 18세+ 계정 필요)로만 흘러감
 * - 미설정 시 → 수익이 발생하지 않는 테스트용 자리 표시
 */
export default function AdBanner() {
  const live = !!(CLIENT && SLOT);
  const pushed = useRef(false);

  useEffect(() => {
    if (!live || pushed.current) return;
    try {
      if (!document.querySelector('script[data-gc-adsense="1"]')) {
        const s = document.createElement("script");
        s.async = true;
        s.crossOrigin = "anonymous";
        s.dataset.gcAdsense = "1";
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
        document.head.appendChild(s);
      }
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* ad blocker 등 — 무시 */
    }
  }, [live]);

  if (live) {
    return (
      <div className="card overflow-hidden p-3">
        <p className="mb-2 text-center text-[10px] font-bold tracking-widest text-zinc-500">
          AD · Google AdSense
        </p>
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return (
    <div className="card flex h-full min-h-40 flex-col items-center justify-center gap-2 border-dashed p-5 text-center">
      <span className="text-3xl">📺</span>
      <p className="text-xs font-black text-zinc-300">실제 광고가 걸리는 자리에요</p>
      <p className="max-w-xs text-[11px] leading-relaxed text-zinc-500">
        지금은 테스트 모드라 수익이 0원이에요.
        <br />
        애드센스 승인 후 <code className="rounded bg-ink-2 px-1 text-violet">NEXT_PUBLIC_ADSENSE_*</code>를
        <code className="rounded bg-ink-2 px-1 text-violet"> .env</code>에 넣으면 실전 광고가 켜집니다.
      </p>
      <a
        href="https://adsense.google.com"
        target="_blank"
        rel="noreferrer"
        className="btn-ghost mt-1 text-[11px]"
      >
        애드센스가 뭔지 보기 🔗
      </a>
    </div>
  );
}
