"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { api, fetcher } from "@/components/client";
import { useToast } from "@/components/Toast";
import { Modal, Spinner } from "@/components/ui";
import type { UserPublic } from "@/lib/types";
import { fmtDate, fmtNum } from "@/lib/format";
import { AVATARS } from "@/lib/constants";

interface GiftconStatusLite {
  provider: { name: string; mode: string; ready: boolean };
}

export default function ProfilePage() {
  const { push } = useToast();
  const router = useRouter();
  const { data, mutate } = useSWR<{ user: UserPublic }>("/api/auth/me", fetcher);
  const { data: gcStatus } = useSWR<GiftconStatusLite>("/api/giftcon/status", fetcher);
  const user = data?.user;
  const isPayPalMode = !!gcStatus?.provider.name.includes("PayPal");

  const [payoutEmail, setPayoutEmail] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);

  const [name, setName] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [infoBusy, setInfoBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (!user) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  }

  const nameVal = name ?? user.name;
  const nickVal = nickname ?? user.nickname ?? "";
  const infoDirty = nameVal !== user.name || nickVal !== (user.nickname ?? "");

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!infoDirty || infoBusy) return;
    setInfoBusy(true);
    try {
      const res = await api<{ user: UserPublic }>("/api/profile", {
        method: "PATCH",
        body: { name: nameVal, nickname: nickVal },
      });
      mutate({ user: res.user }, { revalidate: false });
      setName(null);
      setNickname(null);
      push("프로필을 저장했어요 ✨", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "저장에 실패했어요.", "error");
    } finally {
      setInfoBusy(false);
    }
  }

  async function pickAvatar(avatar: string) {
    if (!user) return;
    const prev = data;
    mutate({ user: { ...user, avatar } }, { revalidate: false });
    try {
      await api("/api/profile", { method: "PATCH", body: { avatar } });
      push("아바타를 바꿨어요!", "success");
    } catch (err) {
      mutate(prev, { revalidate: false });
      push(err instanceof Error ? err.message : "변경에 실패했어요.", "error");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwBusy) return;
    if (newPw !== confirmPw) {
      push("새 비밀번호가 서로 달라요.", "error");
      return;
    }
    setPwBusy(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: { currentPassword: currentPw, newPassword: newPw },
      });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      push("비밀번호를 변경했어요 🔐", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "변경에 실패했어요.", "error");
    } finally {
      setPwBusy(false);
    }
  }

  async function deleteAccount() {
    if (deleteText !== "삭제" || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await api("/api/profile", { method: "DELETE" });
      router.replace("/signup");
    } catch (err) {
      push(err instanceof Error ? err.message : "탈퇴에 실패했어요.", "error");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">👤 내 정보</h1>
        <p className="mt-1 text-sm text-zinc-400">프로필과 계정 설정을 관리해요.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* identity */}
        <section className="card p-6">
          <h2 className="text-sm font-black text-white">프로필</h2>
          <div className="mt-4 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card-2 text-4xl">
              {user.avatar}
            </span>
            <div>
              <p className="text-lg font-black text-white">
                {user.nickname || user.name}
                <span className="ml-2 chip bg-gold/15 text-gold">Lv.{user.level}</span>
                {user.role === "ADMIN" && <span className="ml-1 chip bg-violet/15 text-violet">관리자</span>}
              </p>
              <p className="text-xs text-zinc-500">
                {user.email} · {fmtDate(user.createdAt)} 가입 · {fmtNum(user.xp)} XP
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="label">아바타</label>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => pickAvatar(a)}
                  className={`cursor-pointer rounded-xl p-2 text-2xl transition ${
                    user.avatar === a ? "bg-gold/25 ring-1 ring-gold" : "bg-ink-2 hover:bg-card-2"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={saveInfo} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">실명</label>
                <input className="input" maxLength={20} value={nameVal}
                  onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">닉네임 (랭킹 표시용)</label>
                <input className="input" maxLength={16} value={nickVal}
                  onChange={(e) => setNickname(e.target.value)} placeholder="햅틱이" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-gold" disabled={!infoDirty || infoBusy}>
                {infoBusy && <Spinner className="h-4 w-4" />} 프로필 저장
              </button>
            </div>
          </form>
        </section>

        <div className="space-y-4">
          {/* password */}
          <section className="card p-6">
            <h2 className="text-sm font-black text-white">🔐 비밀번호 변경</h2>
            <form onSubmit={changePassword} className="mt-4 space-y-3.5">
              <div>
                <label className="label">현재 비밀번호</label>
                <input type="password" className="input" value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">새 비밀번호</label>
                  <input type="password" className="input" value={newPw}
                    onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
                </div>
                <div>
                  <label className="label">새 비밀번호 확인</label>
                  <input type="password" className="input" value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)} required />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-ghost" disabled={pwBusy}>
                  {pwBusy && <Spinner className="h-4 w-4" />} 변경하기
                </button>
              </div>
            </form>
          </section>

          {/* PayPal 수령 이메일 — 자동 송금 모드에서만 표시 */}
          {isPayPalMode && (
            <section className="card p-6">
              <h2 className="text-sm font-black text-white">💸 PayPal 수령 이메일</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                당첨 시 이 이메일의 PayPal 계정으로 자동 송금돼요.
                PayPal 계정은 만 18세 이상만 만들 수 있으니, 없다면 부모님 계정을 상의해서 쓰세요.
              </p>
              <form
                className="mt-4 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (payoutBusy) return;
                  setPayoutBusy(true);
                  try {
                    const res = await api<{ user: UserPublic }>("/api/profile", {
                      method: "PATCH",
                      body: { payoutEmail },
                    });
                    mutate({ user: res.user }, { revalidate: false });
                    push("PayPal 이메일을 저장했어요 💸", "success");
                  } catch (err) {
                    push(err instanceof Error ? err.message : "저장에 실패했어요.", "error");
                  } finally {
                    setPayoutBusy(false);
                  }
                }}
              >
                <input
                  type="email"
                  className="input flex-1"
                  placeholder="you@paypal.com"
                  value={payoutEmail || (user.payoutEmail ?? "")}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                />
                <button type="submit" className="btn-gold" disabled={payoutBusy}>
                  {payoutBusy && <Spinner className="h-4 w-4" />} 저장
                </button>
              </form>
            </section>
          )}

          {/* danger zone */}
          <section className="rounded-2xl border border-pink/40 bg-pink/5 p-6">
            <h2 className="text-sm font-black text-pink">⚠️ 위험 구역</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              탈퇴하면 깨기 내역, 기프트, XP가 모두 삭제되고 복구할 수 없어요.
            </p>
            <button className="btn-danger mt-4 text-xs" onClick={() => setDeleteOpen(true)}>
              계정 탈퇴
            </button>
          </section>
        </div>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="정말 탈퇴할까요? 🥺">
        <p className="text-sm leading-relaxed text-zinc-300">
          계정과 모든 데이터(기프트, XP, 내역)가 즉시 삭제됩니다.
          계속하려면 아래에 <b className="text-pink">삭제</b> 를 입력해주세요.
        </p>
        <input
          className="input mt-4"
          value={deleteText}
          onChange={(e) => setDeleteText(e.target.value)}
          placeholder="삭제"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDeleteOpen(false)}>취소</button>
          <button className="btn-danger" disabled={deleteText !== "삭제" || deleteBusy} onClick={deleteAccount}>
            {deleteBusy && <Spinner className="h-4 w-4" />} 영구 삭제
          </button>
        </div>
      </Modal>
    </div>
  );
}
