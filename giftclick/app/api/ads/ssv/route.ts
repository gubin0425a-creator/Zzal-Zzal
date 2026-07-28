import { NextRequest, NextResponse } from "next/server";
import { createPublicKey, createVerify } from "node:crypto";
import { db } from "@/lib/db";
import { grantAdReward } from "@/lib/ads";

export const dynamic = "force-dynamic";

/**
 * AdMob 보상형 광고 SSV (Server-Side Verification) 콜백.
 *
 * 구글 서버가 직접 호출 — "이 user_id가 광고를 정말 끝까지 봤음"을
 * ECDSA 서명으로 증명. 클라이언트 조작이 원천 불가한 최종 지급 경로.
 *
 * AdMob 콘솔 → 보상형 광고 단위 → 서버 측 검증(SSV):
 *   리워드 URL = https://YOUR-DOMAIN/api/ads/ssv   (파라미터는 구글이 자동 부착)
 *
 * 주의: 테스트 광고에서는 SSV가 동작하지 않고 프로덕션 광고에서만 호출됨.
 */

const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const KEY_TTL_MS = 6 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __GC_SSV_KEYS: { at: number; map: Map<number, string> } | undefined;
}

async function getVerifierKeys(): Promise<Map<number, string>> {
  const cached = globalThis.__GC_SSV_KEYS;
  if (cached && Date.now() - cached.at < KEY_TTL_MS) return cached.map;
  const res = await fetch(KEYS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`검증키 다운로드 실패 (${res.status})`);
  const json = (await res.json()) as { keys?: { keyId: number; pem: string }[] };
  const map = new Map<number, string>();
  for (const k of json.keys ?? []) {
    if (typeof k.keyId === "number" && k.pem) map.set(k.keyId, k.pem);
  }
  if (map.size === 0) throw new Error("검증키 형식이 올바르지 않아요");
  globalThis.__GC_SSV_KEYS = { at: Date.now(), map };
  return map;
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search.slice(1);
  const p = req.nextUrl.searchParams;
  const signature = p.get("signature");
  const keyId = Number(p.get("key_id") ?? NaN);
  const userId = p.get("user_id") ?? "";
  const txId = p.get("transaction_id") ?? "";

  if (!signature || !Number.isFinite(keyId) || !userId || !txId) {
    return NextResponse.json(
      { error: "필수 파라미터 누락 (signature / key_id / user_id / transaction_id)" },
      { status: 400 },
    );
  }

  // 쿼리에서 signature 직전까지가 서명 대상 (signature, key_id는 항상 마지막 둘, 이 순서)
  const sigIdx = qs.indexOf("signature=");
  if (sigIdx <= 1) {
    return NextResponse.json({ error: "서명 대상 쿼리가 없어요" }, { status: 400 });
  }
  const contentToVerify = qs.slice(0, sigIdx - 1);

  // 구글 공개키로 ECDSA 서명 검증 (키가 안 맞으면 재로드 후 한 번 더)
  let verified = false;
  try {
    let keys = await getVerifierKeys();
    let pem = keys.get(keyId);
    if (!pem) {
      globalThis.__GC_SSV_KEYS = undefined;
      keys = await getVerifierKeys();
      pem = keys.get(keyId);
    }
    if (!pem) {
      return NextResponse.json({ error: `key_id ${keyId} 공개키를 찾지 못했어요` }, { status: 400 });
    }
    // 서명은 웹세이프 base64 ( - → + , _ → / ), 패딩 보정
    const b64 = signature.replaceAll("-", "+").replaceAll("_", "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const sigBuf = Buffer.from(padded, "base64");
    const pubKey = createPublicKey(pem);
    for (const enc of ["der", "ieee-p1363"] as const) {
      try {
        const v = createVerify("sha256");
        v.update(contentToVerify, "utf8");
        if (v.verify({ key: pubKey, dsaEncoding: enc }, sigBuf)) {
          verified = true;
          break;
        }
      } catch {
        /* 다음 인코딩 시도 */
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: `검증키 조회 실패: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  if (!verified) {
    return NextResponse.json({ error: "서명 검증 실패 — 조작된 콜백일 수 있어요" }, { status: 400 });
  }

  const user = db().prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) {
    return NextResponse.json({ error: "알 수 없는 user_id" }, { status: 400 });
  }

  // transaction_id 를 원장 PK에 박아 중복 지급 원천 차단 (구글 재시도 안전)
  const grant = grantAdReward(userId, `adv_ssv_${txId}`, "AdMob 보상형(SSV)");
  if (!grant.ok) {
    if (grant.status === 409) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: grant.error }, { status: grant.status });
  }
  return NextResponse.json({ ok: true, verified: true, credits: grant.credits });
}
