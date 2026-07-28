import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 | 기프트클릭",
  description: "기프트클릭(GiftClick) 개인정보처리방침",
};

/**
 * 공개 개인정보처리방침 — Google Play 등록 시 필수 URL.
 * 공개 URL이어야 해서 로그인 없이 열립니다 (/privacy).
 * ※ 배포 전 문의 이메일을 실제 주소로 바꿔 두세요.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/login" className="text-xs font-bold text-violet hover:underline">
        ← 기프트클릭으로 돌아가기
      </Link>
      <h1 className="mt-3 font-display text-3xl text-white">개인정보처리방침</h1>
      <p className="mt-1 text-xs text-zinc-500">시행일: 2026-07-28 · 버전 1.0</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-300">
        <section className="card p-5">
          <h2 className="font-black text-white">1. 운영자</h2>
          <p className="mt-2">
            기프트클릭(이하 &quot;서비스&quot;)은 개발자(아래 문의처)가 운영하는 모바일 이벤트 게임 서비스입니다.
            서비스는 개인정보를 소중히 여기며, 개인정보 보호 관련 법규를 준수합니다.
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            문의: <span className="text-zinc-200">(문의 이메일 입력 — 예: giftclick.contact@gmail.com)</span>
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-black text-white">2. 수집하는 개인정보 항목</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><b>가입 시</b>: 이메일 주소, 이름(표시명), 닉네임, 프로필 이모지, 비밀번호(암호화하여 저장)</li>
            <li><b>이용 중 자동 생성</b>: 게임 진행 기록(클릭·부화·보상), 기프트 발급 이력, 광고 시청 이력, 접속 로그</li>
            <li><b>광고 SDK</b>: Google AdMob이 수집하는 광고 ID(AD ID), 기기 정보, 쿠키류 식별자 (제3자 SDK 수집)</li>
            <li><b>결제(선택)</b>: 결제수단 정보는 결제대행사(토스페이먼츠)가 직접 처리하며, 서비스에는 주문번호·금액·결제 상태만 저장됩니다</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-black text-white">3. 이용 목적</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>회원 식별, 게임 진행/보상 지급, 기프트 발급·관리</li>
            <li>광고 송출 및 보상 지급, 어뷰징(부정 이용) 방지</li>
            <li>결제 처리 및 영수증·주문 내역 제공, 고객 문의 대응</li>
            <li>서비스 품질 개선을 위한 통계 분석</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-black text-white">4. 보관·파기</h2>
          <p className="mt-2">
            회원 탈퇴 시 수집된 개인정보는 지체 없이 파기합니다. 다만 결제·광고·발급 원장과 같이
            관련 법령(전자상거래법 등)에 따라 보관이 필요한 항목은 해당 기간(예: 계약·대금결제 기록 5년) 보관 후 파기합니다.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-black text-white">5. 제3자 제공 및 외부 서비스</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>서비스는 이용자의 개인정보를 외부에 판매·제공하지 않습니다.</li>
            <li>
              광고 송출을 위해 <b>Google AdMob/AdSense</b> SDK가 부가 목적으로 쿠키·광고식별자를 이용할 수 있으며,
              수집은 Google의 개인정보처리방침을 따릅니다.
              광고 개인화는 <a className="text-violet underline" href="https://adssettings.google.com" target="_blank" rel="noreferrer">Google 광고 설정</a>에서 해제할 수 있고,
              광고 ID는 기기 설정에서 재설정/삭제할 수 있습니다.
            </li>
            <li>결제 진행은 PG사(토스페이먼츠 등)의 정책 및 계약에 따라 처리됩니다.</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-black text-white">6. 이용자의 권리</h2>
          <p className="mt-2">
            이용자는 언제든지 앱 내 <b>내 정보</b> 메뉴에서 개인정보를 열람·수정하거나 계정을 삭제할 수 있습니다.
            보호자(법정대리인)가 문의하면 확인·조치에 응답합니다.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-black text-white">7. 방침의 변경</h2>
          <p className="mt-2">
            이 방침을 변경하는 경우 앱 내 공지 및 이 페이지를 통해 시행일 7일 전부터 안내합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
