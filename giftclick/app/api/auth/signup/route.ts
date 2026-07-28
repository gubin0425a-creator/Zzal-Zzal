import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, genId, now, toUser } from "@/lib/db";
import { setSessionCookie, badRequest } from "@/lib/session";
import { DAILY_CREDITS, AVATARS } from "@/lib/constants";
import { newEggMaxHp } from "@/lib/game";
import { EMAIL_RE } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();

  if (!name || name.length > 20) return badRequest("이름은 1~20자로 입력해주세요.");
  if (!EMAIL_RE.test(email)) return badRequest("이메일 형식이 올바르지 않습니다.");
  if (password.length < 8 || password.length > 72)
    return badRequest("비밀번호는 8자 이상이어야 합니다.");

  const d = db();
  const exists = d.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return badRequest("이미 가입된 이메일입니다.");

  const id = genId("usr");
  const t = now();
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  d.prepare(
    `INSERT INTO users (id, email, password_hash, name, nickname, avatar, role, xp, credits, last_refill, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, 'USER', 0, ?, ?, ?, ?)`,
  ).run(id, email, bcrypt.hashSync(password, 10), name, avatar, DAILY_CREDITS, t, t, t);

  const maxHp = newEggMaxHp();
  d.prepare(
    "INSERT INTO egg_states (user_id, hp, max_hp, cycle, total_clicks) VALUES (?, ?, ?, 1, 0)",
  ).run(id, maxHp, maxHp);

  await setSessionCookie(id);
  const user = toUser(d.prepare("SELECT * FROM users WHERE id = ?").get(id));
  return NextResponse.json({ user }, { status: 201 });
}
