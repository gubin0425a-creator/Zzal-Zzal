"use client";

import { Capacitor } from "@capacitor/core";

export const ADMOB_APP_ID = process.env.NEXT_PUBLIC_ADMOB_APP_ID || "";
const ADMOB_REWARDED_ID = process.env.NEXT_PUBLIC_ADMOB_REWARDED_ID || "";
/** AdMob 콘솔에 SSV 콜백 URL을 등록하고 배포까지 끝났으면 "1" */
const SSV_ACTIVE = process.env.NEXT_PUBLIC_ADS_SSV_ACTIVE === "1";

/** 안드로이드 앱(네이티브) 안에서 보상형 광고를 쓸 수 있는 조건인지 */
export function nativeAdsAvailable(): boolean {
  return Capacitor.isNativePlatform() && !!ADMOB_REWARDED_ID;
}

/** 프로덕션 광고에서 구글 SSV 서버지급이 켜진 상태면, 클라는 지급 대신 상태만 폴 */
export function ssvActive(): boolean {
  return SSV_ACTIVE;
}

export type NativeRewardResult =
  | { kind: "rewarded"; amount?: number; type?: string }
  | { kind: "dismissed" }
  | { kind: "error"; message: string };

/**
 * 진짜 AdMob 보상형 동영상 광고 재생 → 끝까지 본 경우만 rewarded.
 * SSV userId 에 우리 서비스 user id를 심어 서버검증 콜백이 누구에게 줄지 알게 함.
 */
export async function playNativeRewarded(userId: string): Promise<NativeRewardResult> {
  if (!nativeAdsAvailable()) {
    return { kind: "error", message: "네이티브 광고를 쓸 수 없는 환경이에요." };
  }
  try {
    const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");
    await AdMob.initialize().catch(() => undefined);

    return await new Promise<NativeRewardResult>((resolve) => {
      let settled = false;
      const handles: { remove: () => Promise<void> }[] = [];
      const cleanup = async () => {
        for (const h of handles) {
          try {
            await h.remove();
          } catch {
            /* noop */
          }
        }
      };
      const done = (r: NativeRewardResult) => {
        if (settled) return;
        settled = true;
        void cleanup();
        resolve(r);
      };
      const sub = (p: Promise<{ remove: () => Promise<void> }>) => void p.then((h) => handles.push(h));

      sub(AdMob.addListener(RewardAdPluginEvents.Rewarded, (item) => {
        done({ kind: "rewarded", amount: item?.amount, type: item?.type });
      }));
      sub(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => done({ kind: "dismissed" })));
      sub(AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (e) =>
        done({ kind: "error", message: `광고 로드 실패: ${JSON.stringify(e)}` }),
      ));
      sub(AdMob.addListener(RewardAdPluginEvents.FailedToShow, (e) =>
        done({ kind: "error", message: `광고 재생 실패: ${JSON.stringify(e)}` }),
      ));

      AdMob.prepareRewardVideoAd({
        adId: ADMOB_REWARDED_ID,
        ssv: { userId, customData: "giftclick-credit-reward" },
      })
        .then(() => AdMob.showRewardVideoAd())
        .then((reward) => {
          // 일부 버전은 이벤트 대신 반환값으로 보상을 줌
          if (reward && (reward.amount ?? 0) >= 0 && !settled) {
            done({ kind: "rewarded", amount: reward.amount, type: reward.type });
          }
        })
        .catch((e: unknown) => done({ kind: "error", message: String(e) }));
    });
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
