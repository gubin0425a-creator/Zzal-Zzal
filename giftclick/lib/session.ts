import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, toUser } from "./db";
import { COOKIE_NAME } from "./constants";
import { maybeRefill } from "./game";
import { signSessionToken, verifySessionToken } from "./jwt";
import type { UserPublic } from "./types";

export { signSessionToken, verifySessionToken };

export async function setSessionCookie(userId: string) {
  const token = await signSessionToken(userId);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<UserPublic | null> {
  const jar = await cookies();
  const userId = await verifySessionToken(jar.get(COOKIE_NAME)?.value);
  if (!userId) return null;
  const row = db().prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!row) return null;
  return toUser(maybeRefill(row));
}

export async function getSessionUserFresh(): Promise<UserPublic | null> {
  // same as getSessionUser, kept semantic for API callers
  return getSessionUser();
}

export function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

export async function requireAuth(): Promise<
  { user: UserPublic } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: unauthorized() };
  return { user };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
