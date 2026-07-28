import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/jwt";
import { COOKIE_NAME } from "@/lib/constants";

const PUBLIC_PAGES = ["/login", "/signup", "/privacy"];
const PUBLIC_API = [
  "/api/auth/login",
  "/api/auth/signup",
  // 구글 AdMob SSV 콜백 — 구글 서버가 세션 없이 호출 (서명으로 신원 검증)
  "/api/ads/ssv",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = (await verifySessionToken(token)) !== null;
  const isApi = pathname.startsWith("/api/");

  const isPublic = isApi
    ? PUBLIC_API.some((p) => pathname.startsWith(p))
    : PUBLIC_PAGES.some((p) => pathname.startsWith(p));

  if (!authed && !isPublic) {
    if (isApi) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (authed && PUBLIC_PAGES.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)",
  ],
};
