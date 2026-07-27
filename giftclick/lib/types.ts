export type Role = "USER" | "ADMIN";
export type CrackMode = "MANUAL" | "AUTO";
export type RewardStatus = "READY" | "USED" | "EXPIRED";
export type Category =
  | "COFFEE"
  | "FOOD"
  | "CONVENIENCE"
  | "CULTURE"
  | "BEAUTY"
  | "ETC";

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar: string;
  /** PayPal 자동 송금 모드에서 송금 받을 이메일 */
  payoutEmail?: string | null;
  role: Role;
  xp: number;
  credits: number;
  level: number;
  createdAt: string;
}

export interface EggState {
  hp: number;
  maxHp: number;
  cycle: number;
  totalClicks: number;
  /** 이지모드 알 여부 (HP 3~5, 해치 풀 5,000원 이하) */
  easy: boolean;
  /** 알에 표시되는 대표 상품 (해치 보상은 가중치 랜덤) */
  featured: { emoji: string; name: string; value: number } | null;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  description: string;
  emoji: string;
  value: number;
  weight: number;
  stock: number; // -1 = unlimited
  active: boolean;
  /** 기프티콘 발급사 상품 코드(카탈로그 동기화 시 채워짐) */
  providerCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reward {
  id: string;
  userId: string;
  productId: string | null;
  title: string;
  brand: string;
  emoji: string;
  value: number;
  pinCode: string;
  status: RewardStatus;
  memo: string;
  expiresAt: string;
  usedAt: string | null;
  /** 발급사 ("기프티엘", "기프티엘 샌드박스", null = 수동 등록) */
  provider?: string | null;
  /** 발급사 거래번호 */
  providerTr?: string | null;
  /** 발급 상태 (ISSUED / PENDING / CANCELED) */
  providerStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Crack {
  id: string;
  userId: string;
  productId: string | null;
  productName: string | null;
  productEmoji: string | null;
  productValue: number | null;
  mode: CrackMode;
  hatched: boolean;
  xp: number;
  createdAt: string;
}

export interface CrackResult {
  credits: number;
  xp: number;
  egg: EggState;
  hatched: boolean;
  bonusCredit: boolean;
  reward?: Reward;
  error?: string;
}

export interface LeaderRow {
  nickname: string;
  avatar: string;
  xp: number;
  level: number;
}

export interface AdminAdStats {
  totalViews: number;
  totalEstCents: number;
  todayViews: number;
  todayEstCents: number;
}

export interface AdsStatus {
  /** sandbox = 테스트 광고 / live = NEXT_PUBLIC_ADSENSE_* 설정됨 */
  mode: "sandbox" | "live";
  bannerReady: boolean;
  rewardCredits: number;
  dailyCap: number;
  viewsToday: number;
  remainingToday: number;
  cooldownSec: number;
  cooldownRemainSec: number;
  estPerViewCents: number;
  /** 내 오늘 예상 수익(견적) — 원 × 100 */
  todayEstCents: number;
  /** 내 누적 예상 수익(견적) */
  totalEstCents: number;
  mockAdSec: number;
  admin?: AdminAdStats;
}

export interface AdCompleteResult {
  ok: boolean;
  credits: number;
  viewsToday: number;
  remainingToday: number;
  estCents: number;
  todayEstCents: number;
}

export interface StatsPayload {
  user: UserPublic;
  egg: EggState;
  totals: {
    cracks: number;
    eggsHatched: number;
    totalValue: number;
    ready: number;
    used: number;
    expired: number;
    products: number;
  };
  streakDays: number;
  weekly: { day: string; label: string; count: number }[];
  recentRewards: Reward[];
  topWin: Reward | null;
  leaderboard: LeaderRow[];
}
