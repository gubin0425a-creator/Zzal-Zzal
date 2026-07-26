const krw = new Intl.NumberFormat("ko-KR");

export function fmtKRW(n: number): string {
  return `${krw.format(n)}원`;
}

export function fmtNum(n: number): string {
  return krw.format(n);
}

function toDate(iso: string): Date {
  return new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
}

export function fmtDate(iso: string): string {
  const d = toDate(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fmtDateTime(iso: string): string {
  const d = toDate(iso);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTime(iso: string): string {
  const d = toDate(iso);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relTime(iso: string): string {
  const diff = Date.now() - toDate(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}일 전`;
  return fmtDate(iso);
}

export function dDay(expiresAt: string): number {
  const end = toDate(expiresAt).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function dateLabel(iso: string): string {
  const d = toDate(iso);
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "오늘";
  if (same(d, y)) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayKST(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
