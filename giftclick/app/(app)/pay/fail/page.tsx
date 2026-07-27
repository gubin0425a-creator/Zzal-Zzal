"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function FailInner() {
  const params = useSearchParams();
  const code = params.get("code") || "";
  const message = params.get("message") || "결제가 취소됐거나 실패했어요.";
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center">
        <p className="text-6xl">💸</p>
        <h1 className="mt-3 text-xl font-black text-white">결제가 완료되지 않았어요</h1>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        {code && <p className="mt-1 text-[11px] text-zinc-500">오류 코드: {code}</p>}
        <Link href="/shop" className="btn-gold mt-6 block">충전소로 돌아가기 🛒</Link>
      </div>
    </div>
  );
}

export default function PayFailPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-64 max-w-md rounded-2xl" />}>
      <FailInner />
    </Suspense>
  );
}
