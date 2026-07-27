import { db, genId, now } from "./db";
import type { AdsStatus } from "./types";

// ── 광고 리워드 설정 (env로 조절) ────────────────────────────
function intEnv(name: string, def: number, min: number, max: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function adsConfig() {
  return {
    /** 광고 1회 시청 보상 깨기권 수 */
    rewardCredits: intEnv("ADS_REWARD_CREDITS", 2, 1, 10),
    /** 1인당 하루 최대 시청 횟수 */
    dailyCap: intEnv("ADS_DAILY_CAP", 10, 1, 100),
    /** 시청 후 재시청 쿨타임(초) */
    cooldownSec: intEnv("ADS_COOLDOWN_SEC", 60, 5, 3600),
    /** 예상 수익 CPM(원/1000회) — 견적치 계산용 (실수익 아님) */
    estCpmKrw: intEnv("ADS_EST_CPM_KRW", 1000, 0, 1_000_000),
    /** NEXT_PUBLIC_ADSENSE_* 두 개가 모두 설정되면 실전 배너 모드 */
    bannerReady:
      !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT && !!process.env.NEXT_PUBLIC_ADSENSE_SLOT,
  };
}

/** 샌드박스(테스트) 광고 시청 길이(초) */
export const MOCK_AD_SEC = 5;

/** CPM(원/1000회) → 1회 시청당 예상 수익 (원 × 100, 소수점 보존용 셴트) */
export function estPerViewCents(): number {
  return Math.round(adsConfig().estCpmKrw / 10);
}

function kstDay(dateLike: string | number | Date): string {
  return new Date(dateLike).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export interface AdViewRow {
  id: string;
  user_id: string;
  provider: string;
  credits_granted: number;
  est_cents: number;
  created_at: string;
}

/** 현재 광고 상태 (남은 쿨타임/오늘 시청 수/예상 수익) */
export function adsStatus(uid: string, isAdmin: boolean): AdsStatus {
  const d = db();
  const cfg = adsConfig();
  const rows = d
    .prepare("SELECT * FROM ad_views WHERE user_id = ? ORDER BY created_at DESC LIMIT 500")
    .all(uid) as unknown as AdViewRow[];

  const today = kstDay(new Date());
  const todayRows = rows.filter((r) => kstDay(String(r.created_at)) === today);
  const last = rows[0];
  const elapsedSec = last
    ? (Date.now() - new Date(String(last.created_at)).getTime()) / 1000
    : Infinity;
  const cooldownRemainSec = Number.isFinite(elapsedSec)
    ? Math.max(0, Math.ceil(cfg.cooldownSec - elapsedSec))
    : 0;

  const agg = d
    .prepare("SELECT COUNT(*) c, COALESCE(SUM(est_cents),0) s FROM ad_views WHERE user_id = ?")
    .get(uid);

  const status: AdsStatus = {
    mode: cfg.bannerReady ? "live" : "sandbox",
    bannerReady: cfg.bannerReady,
    rewardCredits: cfg.rewardCredits,
    dailyCap: cfg.dailyCap,
    viewsToday: todayRows.length,
    remainingToday: Math.max(0, cfg.dailyCap - todayRows.length),
    cooldownSec: cfg.cooldownSec,
    cooldownRemainSec,
    estPerViewCents: estPerViewCents(),
    todayEstCents: todayRows.reduce((s, r) => s + Number(r.est_cents || 0), 0),
    totalEstCents: Number(agg?.s ?? 0),
    mockAdSec: MOCK_AD_SEC,
  };

  if (isAdmin) {
    const g = d
      .prepare("SELECT COUNT(*) c, COALESCE(SUM(est_cents),0) s FROM ad_views")
      .get();
    const recent = d
      .prepare("SELECT est_cents, created_at FROM ad_views ORDER BY created_at DESC LIMIT 1000")
      .all() as unknown as Pick<AdViewRow, "est_cents" | "created_at">[];
    const gToday = recent.filter((r) => kstDay(String(r.created_at)) === today);
    status.admin = {
      totalViews: Number(g?.c ?? 0),
      totalEstCents: Number(g?.s ?? 0),
      todayViews: gToday.length,
      todayEstCents: gToday.reduce((s, r) => s + Number(r.est_cents || 0), 0),
    };
  }

  return status;
}

export type GrantResult =
  | {
      ok: true;
      credits: number;
      viewsToday: number;
      remainingToday: number;
      estCents: number;
      todayEstCents: number;
    }
  | { ok: false; error: string; status: number };

/** 광고 시청 완료 → 깨기권 지급 + 원장 기록 (쿨타임/일일 한도는 서버가 강제)
 *  fixedId: SSV처럼 외부 트랜잭션 ID를 PK로 박아 중복 지급을 막을 때 사용 */
export function grantAdReward(uid: string, fixedId?: string, providerOverride?: string): GrantResult {
  const d = db();
  const cfg = adsConfig();

  const last = d
    .prepare("SELECT created_at FROM ad_views WHERE user_id = ? ORDER BY created_at DESC")
    .get(uid);
  if (last) {
    const elapsedSec = (Date.now() - new Date(String(last.created_at)).getTime()) / 1000;
    if (elapsedSec < cfg.cooldownSec) {
      return {
        ok: false,
        status: 429,
        error: `${Math.ceil(cfg.cooldownSec - elapsedSec)}초 뒤에 다음 광고를 볼 수 있어요.`,
      };
    }
  }

  const rows = d
    .prepare("SELECT created_at, est_cents FROM ad_views WHERE user_id = ? ORDER BY created_at DESC LIMIT 500")
    .all(uid) as unknown as Pick<AdViewRow, "created_at" | "est_cents">[];
  const today = kstDay(new Date());
  const todayRows = rows.filter((r) => kstDay(String(r.created_at)) === today);
  if (todayRows.length >= cfg.dailyCap) {
    return {
      ok: false,
      status: 429,
      error: `오늘의 광고 시청(${cfg.dailyCap}회)을 모두 사용했어요. 내일 자정에 초기화돼요!`,
    };
  }

  const est = estPerViewCents();
  try {
    d.prepare(
      "INSERT INTO ad_views (id, user_id, provider, credits_granted, est_cents, created_at) VALUES (?,?,?,?,?,?)",
    ).run(
      fixedId ?? genId("adv"),
      uid,
      providerOverride ?? (cfg.bannerReady ? "Google AdSense" : "테스트 광고"),
      cfg.rewardCredits,
      est,
      now(),
    );
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { ok: false, status: 409, error: "이미 지급된 시청(트랜잭션)이에요." };
    }
    throw e;
  }
  d.prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?").run(
    cfg.rewardCredits,
    now(),
    uid,
  );
  const credits = Number(
    d.prepare("SELECT credits c FROM users WHERE id = ?").get(uid)?.c ?? 0,
  );

  return {
    ok: true,
    credits,
    viewsToday: todayRows.length + 1,
    remainingToday: Math.max(0, cfg.dailyCap - (todayRows.length + 1)),
    estCents: est,
    todayEstCents: todayRows.reduce((s, r) => s + Number(r.est_cents || 0), 0) + est,
  };
}
