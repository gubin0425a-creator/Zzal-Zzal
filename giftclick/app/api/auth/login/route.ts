import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, toUser } from "@/lib/db";
import { setSessionCookie, badRequest } from "@/lib/session";
import { maybeRefill } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return badRequest("이메일과 비밀번호를 입력해주세요.");

  const row = db().prepare("SELECT * FROM users WHERE email = ?").get(email);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ok = row && bcrypt.compareSync(password, String((row as any).password_hash));
  if (!ok)
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );

  await setSessionCookie(String((row as { id: string }).id));
  const user = toUser(maybeRefill(row));
  return NextResponse.json({ user });
}
