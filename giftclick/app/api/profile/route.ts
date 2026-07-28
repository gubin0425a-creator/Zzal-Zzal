import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, now, toUser } from "@/lib/db";
import { requireAuth, badRequest, clearSessionCookie } from "@/lib/session";
import { AVATARS } from "@/lib/constants";
import { EMAIL_RE } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  const d = db();
  const user = auth.user;

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 20) return badRequest("이름은 1~20자로 입력해주세요.");
    d.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(name, now(), user.id);
  }
  if (body.nickname !== undefined) {
    const nickname = String(body.nickname).trim().slice(0, 16);
    d.prepare("UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?").run(
      nickname || null, now(), user.id,
    );
  }
  if (body.payoutEmail !== undefined) {
    const email = String(body.payoutEmail).trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return badRequest("이메일 형식이 올바르지 않습니다.");
    d.prepare("UPDATE users SET payout_email = ?, updated_at = ? WHERE id = ?").run(
      email || null, now(), user.id,
    );
  }
  if (body.avatar !== undefined) {
    const avatar = String(body.avatar);
    if (!AVATARS.includes(avatar)) return badRequest("선택할 수 없는 아바타입니다.");
    d.prepare("UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?").run(avatar, now(), user.id);
  }

  if (body.newPassword !== undefined) {
    const current = String(body.currentPassword ?? "");
    const next = String(body.newPassword);
    if (next.length < 8) return badRequest("새 비밀번호는 8자 이상이어야 합니다.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = d.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as any;
    if (!row || !bcrypt.compareSync(current, String(row.password_hash)))
      return badRequest("현재 비밀번호가 올바르지 않습니다.");
    d.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      bcrypt.hashSync(next, 10), now(), user.id,
    );
  }

  const updated = toUser(d.prepare("SELECT * FROM users WHERE id = ?").get(user.id));
  return NextResponse.json({ user: updated });
}

export async function DELETE() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;
  db().prepare("DELETE FROM users WHERE id = ?").run(auth.user.id);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
