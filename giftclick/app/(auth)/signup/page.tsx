"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/components/client";
import { Spinner } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const strength =
    password.length === 0 ? 0 : password.length < 8 ? 1 : /[0-9]/.test(password) && /[a-zA-Z]/.test(password) ? 3 : 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("비밀번호가 서로 다릅니다. 한 번만 더 확인해주세요!");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/signup", { method: "POST", body: { name, email, password } });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했어요.");
      setBusy(false);
    }
  }

  return (
    <div className="slide-up">
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <span className="text-2xl">🥚</span>
        <span className="font-display text-xl text-white">
          기프트<span className="text-gold">클릭</span>
        </span>
      </div>

      <h1 className="text-2xl font-black text-white">햅테크 입문, 준비됐지? 🎰</h1>
      <p className="mt-1.5 text-sm text-zinc-400">
        가입 즉시 깨기권 5개와 첫 금계란이 기다려요.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label className="label" htmlFor="name">이름</label>
          <input
            id="name" className="input" placeholder="김햅틱"
            value={name} onChange={(e) => setName(e.target.value)} required maxLength={20}
          />
        </div>
        <div>
          <label className="label" htmlFor="email">이메일</label>
          <input
            id="email" type="email" className="input" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">비밀번호</label>
          <input
            id="password" type="password" className="input" placeholder="8자 이상"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          {password.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    strength === 1 ? "w-1/3 bg-pink" : strength === 2 ? "w-2/3 bg-gold" : "w-full bg-mint"
                  }`}
                />
              </div>
              <span className="text-[10px] font-bold text-zinc-500">
                {strength === 1 ? "8자 이상 필요" : strength === 2 ? "좋아요" : "튼튼해요"}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="confirm">비밀번호 확인</label>
          <input
            id="confirm" type="password" className="input" placeholder="한 번 더 입력"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} required
          />
        </div>

        {error && (
          <div className="fade-in rounded-xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm font-semibold text-pink">
            💥 {error}
          </div>
        )}

        <button type="submit" className="btn-gold w-full py-3 text-base" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          가입하고 첫 금계란 받기 🎁
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-black text-violet hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
