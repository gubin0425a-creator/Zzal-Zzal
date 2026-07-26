import bcrypt from "bcryptjs";
import { genId, genPinCode, now } from "./id";

type DBHandle = {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => unknown;
    get: (...params: unknown[]) => Record<string, unknown> | undefined;
  };
};

function daysAgo(n: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute + Math.floor(Math.random() * 50), 0, 0);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const PRODUCTS: Array<{
  name: string; brand: string; category: string; description: string;
  emoji: string; value: number; weight: number; stock: number;
}> = [
  { name: "아이스 아메리칸오", brand: "스타벅스", category: "COFFEE", description: "시원한 아메리칸오 Tall 사이즈", emoji: "🥤", value: 4500, weight: 30, stock: -1 },
  { name: "메가커피 2,000원 쿠폰", brand: "메가MGC커피", category: "COFFEE", description: "전 메뉴 이용 가능 모바일 쿠폰", emoji: "☕", value: 2000, weight: 40, stock: -1 },
  { name: "딸기생크림 조각케이크", brand: "투썸플레이스", category: "COFFEE", description: "부드러운 시즌 조각 케이크", emoji: "🍰", value: 6500, weight: 15, stock: 40 },
  { name: "카페라떼 그란데", brand: "이디야", category: "COFFEE", description: "진한 에스프레소 라떼", emoji: "🥛", value: 4200, weight: 28, stock: -1 },
  { name: "뿌링클 + 콜라 1.25L", brand: "BHC치킨", category: "FOOD", description: "치즈 시즈닝 치킨 세트", emoji: "🍗", value: 20000, weight: 6, stock: 15 },
  { name: "허니콤보", brand: "교촌치킨", category: "FOOD", description: "달콤한 허니 소스 치킨", emoji: "🍯", value: 21000, weight: 5, stock: 12 },
  { name: "포테이토 피자 M", brand: "도미노피자", category: "FOOD", description: "오리지널 포테이토 미디엄", emoji: "🍕", value: 25000, weight: 4, stock: 10 },
  { name: "싸이버거 세트", brand: "맘스터치", category: "FOOD", description: "통다리살 버거 세트", emoji: "🍔", value: 8500, weight: 14, stock: 30 },
  { name: "김밥 2줄 세트", brand: "김밥천국", category: "FOOD", description: "야채+참치 김밥 콤보", emoji: "🍙", value: 7000, weight: 16, stock: -1 },
  { name: "CU 5,000원 상품권", brand: "CU", category: "CONVENIENCE", description: "전국 CU 매장 사용 가능", emoji: "🏪", value: 5000, weight: 18, stock: -1 },
  { name: "GS25 10,000원권", brand: "GS25", category: "CONVENIENCE", description: "전국 GS25 매장 사용 가능", emoji: "🛒", value: 10000, weight: 8, stock: 25 },
  { name: "이마트24 3,000원권", brand: "이마트24", category: "CONVENIENCE", description: "삼각김밥 사먹기 딱 좋은 금액", emoji: "🏷️", value: 3000, weight: 22, stock: -1 },
  { name: "OTT 1개월 이용권", brand: "넷플릭스", category: "CULTURE", description: "프리미엄 1개월 구독권", emoji: "📺", value: 13500, weight: 7, stock: 20 },
  { name: "영화 관람권 1매", brand: "CGV", category: "CULTURE", description: "2D 일반 영화 관람권", emoji: "🎬", value: 13000, weight: 7, stock: 20 },
  { name: "음악 스트리밍 30일", brand: "멜론", category: "CULTURE", description: "모바일 스트리밍 이용권", emoji: "🎵", value: 10900, weight: 8, stock: 20 },
  { name: "올리브영 50,000원권", brand: "올리브영", category: "BEAUTY", description: "전 최고 보스템! 기프트카드", emoji: "💄", value: 50000, weight: 1, stock: 3 },
  { name: "배달 30,000원 쿠폰", brand: "배달의민족", category: "FOOD", description: "야식은 거기서 거기, 쿠폰이 최고", emoji: "🛵", value: 30000, weight: 3, stock: 6 },
  { name: "카카오 이모티콘", brand: "카카오", category: "CULTURE", description: "인기 이모티콘 랜덤 지급", emoji: "😆", value: 2500, weight: 25, stock: -1 },
];

export function runSeed(d: DBHandle) {
  const t = now();
  const insertUser = d.prepare(
    `INSERT INTO users (id, email, password_hash, name, nickname, avatar, role, xp, credits, last_refill, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertEgg = d.prepare(
    `INSERT INTO egg_states (user_id, hp, max_hp, cycle, total_clicks) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertProduct = d.prepare(
    `INSERT INTO products (id, name, brand, category, description, emoji, value, weight, stock, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  );
  const insertCrack = d.prepare(
    `INSERT INTO cracks (id, user_id, product_id, product_name, product_emoji, product_value, mode, hatched, xp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReward = d.prepare(
    `INSERT INTO rewards (id, user_id, product_id, title, brand, emoji, value, pin_code, status, memo, expires_at, used_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // ---- users ----
  const adminId = genId("usr");
  const demoId = genId("usr");
  const f1 = genId("usr");
  const f2 = genId("usr");
  const f3 = genId("usr");

  insertUser.run(adminId, "admin@giftclick.kr", bcrypt.hashSync("admin1234", 10), "햅틱관리자", "마스터햅", "🛠️", "ADMIN", 7300, 9, t, daysAgo(40), t);
  insertUser.run(demoId, "demo@giftclick.kr", bcrypt.hashSync("demo1234", 10), "김햅틱", "햅틱이", "🐣", "USER", 0, 8, t, daysAgo(21), t);
  insertUser.run(f1, "dangchum@giftclick.kr", bcrypt.hashSync("demo1234", 10), "박당첨", "당첨왕", "🦊", "USER", 5200, 3, t, daysAgo(33), t);
  insertUser.run(f2, "hapluck@giftclick.kr", bcrypt.hashSync("demo1234", 10), "이햅럭", "럭키럭", "🐰", "USER", 4100, 5, t, daysAgo(17), t);
  insertUser.run(f3, "daebak@giftclick.kr", bcrypt.hashSync("demo1234", 10), "최대박", "대박러", "🐻", "USER", 2300, 1, t, daysAgo(9), t);

  // ---- products ----
  const productIds: Record<string, { id: string; emoji: string; name: string; value: number }> = {};
  for (const p of PRODUCTS) {
    const id = genId("prd");
    productIds[p.name] = { id, emoji: p.emoji, name: p.name, value: p.value };
    insertProduct.run(id, p.name, p.brand, p.category, p.description, p.emoji, p.value, p.weight, p.stock, daysAgo(30), t);
  }

  // ---- demo user history: ~46 cracks over 12 days, 5 hatched ----
  const demoHatches = [
    productIds["메가커피 2,000원 쿠폰"],
    productIds["카카오 이모티콘"],
    productIds["싸이버거 세트"],
    productIds["CU 5,000원 상품권"],
    productIds["뿌링클 + 콜라 1.25L"],
  ];
  let totalClicks = 0;
  let xp = 0;
  let hatchIdx = 0;
  const demoRewards: Array<{ h: (typeof demoHatches)[number]; created: string }> = [];

  const clickPlan: Array<[number, number]> = [
    [11, 4], [10, 3], [9, 5], [8, 2], [7, 6], [6, 3], [5, 4], [4, 5], [3, 4], [2, 3], [1, 4], [0, 3],
  ];
  for (const [daysA, count] of clickPlan) {
    for (let i = 0; i < count; i++) {
      totalClicks++;
      const hatch =
        hatchIdx < demoHatches.length &&
        totalClicks >= (hatchIdx + 1) * 9 &&
        Math.random() > 0.4;
      if (hatch) {
        const h = demoHatches[hatchIdx++];
        xp += 510;
        const created = daysAgo(daysA, 14 + i);
        insertCrack.run(genId("crk"), demoId, h.id, h.name, h.emoji, h.value, Math.random() > 0.35 ? "MANUAL" : "AUTO", 1, 510, created);
        demoRewards.push({ h, created });
      } else {
        xp += 10;
        insertCrack.run(
          genId("crk"), demoId, null, null, null, null,
          Math.random() > 0.55 ? "MANUAL" : "AUTO", 0, 10, daysAgo(daysA, 12 + i),
        );
      }
    }
  }
  d.prepare("UPDATE users SET xp = ? WHERE id = ?").run(Math.max(xp, 3300), demoId);
  insertEgg.run(demoId, 4, 9, hatchIdx + 1, totalClicks);

  // demo rewards from hatches
  const statuses = [
    { status: "READY", memo: "커피는 역시 얼죽아", expDays: 21, used: false },
    { status: "USED", memo: "", expDays: 18, used: true },
    { status: "READY", memo: "주말 점심에 쓸 예정 🍔", expDays: 9, used: false },
    { status: "USED", memo: "", expDays: 12, used: true },
    { status: "READY", memo: "금요일 회식 서프라이즈 🎉", expDays: 2, used: false },
  ];
  demoRewards.forEach(({ h, created }, i) => {
    const s = statuses[i % statuses.length];
    insertReward.run(
      genId("rwd"), demoId, h.id, h.name, "", h.emoji, h.value, genPinCode(),
      s.status, s.memo, daysFromNow(s.expDays), s.used ? daysAgo(3) : null, created, t,
    );
  });
  // one expired relic
  const relic = productIds["이마트24 3,000원권"];
  insertReward.run(
    genId("rwd"), demoId, relic.id, relic.name, "", relic.emoji, relic.value, genPinCode(),
    "EXPIRED", "냅뒀다가 만료됨...😭", daysAgo(2), null, daysAgo(33), t,
  );

  // ---- admin: small history + 1 reward ----
  insertEgg.run(adminId, 7, 8, 2, 13);
  for (let i = 0; i < 12; i++) {
    insertCrack.run(genId("crk"), adminId, null, null, null, null, "AUTO", 0, 10, daysAgo(6 - Math.floor(i / 2), 10 + i));
  }
  const adminWin = productIds["영화 관람권 1매"];
  const admCreated = daysAgo(5, 21);
  insertCrack.run(genId("crk"), adminId, adminWin.id, adminWin.name, adminWin.emoji, adminWin.value, "AUTO", 1, 510, admCreated);
  insertReward.run(
    genId("rwd"), adminId, adminWin.id, adminWin.name, "", adminWin.emoji, adminWin.value, genPinCode(),
    "READY", "주말 영화 데이트 🍿", daysFromNow(16), null, admCreated, t,
  );

  // filler egg states
  insertEgg.run(f1, 6, 11, 8, 71);
  insertEgg.run(f2, 2, 7, 5, 43);
  insertEgg.run(f3, 5, 9, 3, 22);

  console.log("[giftclick] demo database seeded");
}
