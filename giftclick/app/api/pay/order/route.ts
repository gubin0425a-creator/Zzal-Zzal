import { NextRequest, NextResponse } from "next/server";
import { db, genId, now, toPayment } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { getPayProvider } from "@/lib/pay";
import { findPack, directPrice } from "@/lib/pay/items";

export const dynamic = "force-dynamic";

/** 주문 생성 — 결제창(토스) 또는 샌드박스 모달로 이어지는 READY 주문 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  let body: { kind?: string; code?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const kind = body.kind === "DIRECT" ? "DIRECT" : "PACK";
  const code = String(body.code || "");
  const d = db();

  // 스팸 방지: 미결제(READY) 주문이 5개 이상이면 새 주문 불가
  const pendingCount = Number(
    d.prepare("SELECT COUNT(*) c FROM payments WHERE user_id = ? AND status IN ('READY','CONFIRMING')")
      .get(auth.user.id)?.c ?? 0,
  );
  if (pendingCount >= 5) {
    return NextResponse.json(
      { error: "결제 대기 중인 주문이 5개예요. 완료하거나 시간을 두고 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  let title: string;
  let amount: number;
  if (kind === "PACK") {
    const pack = findPack(code);
    if (!pack) return NextResponse.json({ error: "존재하지 않는 팩이에요." }, { status: 400 });
    title = pack.bonus > 0 ? `${pack.title} (+${pack.bonus}장 별도)` : pack.title;
    amount = pack.price;
  } else {
    const p = d.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(code);
    if (!p) return NextResponse.json({ error: "판매 중이 아닌 상품이에요." }, { status: 400 });
    if (Number(p.stock) === 0)
      return NextResponse.json({ error: "품절된 상품이에요." }, { status: 400 });
    title = `${p.emoji} ${p.name}`;
    amount = directPrice(Number(p.value));
  }

  const t = now();
  const id = genId("pay");
  const orderId = id.replace("pay_", "ord_");
  const provider = getPayProvider();

  let checkout;
  try {
    checkout = await provider.prepare({
      orderId,
      title,
      amount,
      userId: auth.user.id,
      origin: req.nextUrl.origin,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "결제창 준비에 실패했어요." },
      { status: 400 },
    );
  }

  d.prepare(
    `INSERT INTO payments (id, order_id, user_id, item_kind, item_code, title, amount, status, provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'READY', ?, ?, ?)`,
  ).run(id, orderId, auth.user.id, kind, code, title, amount, provider.name, t, t);

  return NextResponse.json({
    ok: true,
    payment: toPayment(d.prepare("SELECT * FROM payments WHERE id = ?").get(id)),
    checkout,
  });
}
