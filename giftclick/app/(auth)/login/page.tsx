"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/components/client";
import { Spinner } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      router.replace(params.get("next") || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했어요.");
      setBusy(false);
    }
  }

  function fillDemo(which: "demo" | "admin") {
    setEmail(which === "demo" ? "demo@giftclick.kr" : "admin@giftclick.kr");
    setPassword(which === "demo" ? "demo1234" : "admin1234");
    setError("");
  }

  return (
    <div className="slide-up">
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <span className="text-2xl">🥚</span>
        <span className="font-display text-xl text-white">
          기프트<span className="text-gold">클릭</span>
        </span>
      </div>

      <h1 className="text-2xl font-black text-white">다시 왔구나, 햅틱! 👋</h1>
      <p className="mt-1.5 text-sm text-zinc-400">로그인하고 오늘의 금계란을 깨보세요.</p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button onClick={() => fillDemo("demo")} className="btn-ghost text-xs" type="button">
          🐣 데모 계정 입력
        </button>
        <button onClick={() => fillDemo("admin")} className="btn-ghost text-xs" type="button">
          🛠️ 관리자 계정 입력
        </button>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="email">이메일</label>
          <input
            id="email" type="email" className="input" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="password">비밀번호</label>
          <input
            id="password" type="password" className="input" placeholder="8자 이상"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
        </div>

        {error && (
          <div className="fade-in rounded-xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm font-semibold text-pink">
            💥 {error}
          </div>
        )}

        <button type="submit" className="btn-gold w-full py-3 text-base" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          로그인하고 금계란 깨기 🥚
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-black text-violet hover:underline">
          3초 회원가입
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
