import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기프트클릭 — 금계란 햅테크",
  description: "금계란을 두들겨 최대 50,000원 상품을 뽑는 클릭형 햅테크. 터치로, 또는 자동 클릭으로!",
};

export const viewport: Viewport = {
  themeColor: "#0c0716",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
