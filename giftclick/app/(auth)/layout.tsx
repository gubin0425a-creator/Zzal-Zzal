export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-card/60 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet/30 via-card to-ink-2 p-10 lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(400px 300px at 30% 20%, rgba(247,201,72,0.25), transparent 60%), radial-gradient(300px 300px at 80% 90%, rgba(255,92,157,0.2), transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">🥚</span>
              <span className="font-display text-2xl text-white">
                기프트<span className="text-gold">클릭</span>
              </span>
            </div>
            <p className="mt-8 font-display text-4xl leading-tight text-white">
              금계란 깨고
              <br />
              <span className="text-gold">기프트카드</span> 받자
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-300">
              터치로 직접, 또는 자동 클릭으로. 한 알에서 최대{" "}
              <b className="text-gold">50,000원</b> 상당의 상품이 터지는 클릭형 햅테크 🎰
            </p>
          </div>
          <div className="relative space-y-2.5">
            {[
              ["🐣", "매일 자정 깨기권 자동 충전"],
              ["⚡", "자동 깨기(오토 모드) 지원"],
              ["🎁", "당첨 즉시 핀코드 기프트 발급"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200">
                <span className="text-xl">{icon}</span> {text}
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 sm:p-10">{children}</div>
      </div>
    </div>
  );
}
