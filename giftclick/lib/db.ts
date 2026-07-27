import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import type {
  UserPublic,
  EggState,
  Product,
  Reward,
  Crack,
} from "./types";
import { levelFromXp } from "./constants";
import { genId, now } from "./id";
import { runSeed } from "./seed";

export { genId, now };

// node:sqlite is a Node 22 runtime builtin that webpack must not try to bundle,
// so we load it through createRequire with a non-static specifier.
const requireRuntime = createRequire(
  typeof __filename !== "undefined" ? __filename : import.meta.url,
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DatabaseSync } = requireRuntime("node:sqlite") as any;

export type Stmt = {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
};

export type DB = {
  exec: (sql: string) => void;
  prepare: (sql: string) => Stmt;
  close: () => void;
};

const DB_DIR = process.env.GC_DB_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "giftclick.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT,
  avatar TEXT DEFAULT '🐣',
  role TEXT DEFAULT 'USER',
  xp INTEGER DEFAULT 0,
  credits INTEGER DEFAULT 5,
  last_refill TEXT,
  last_bonus TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS egg_states (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  cycle INTEGER DEFAULT 1,
  total_clicks INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'ETC',
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎁',
  value INTEGER NOT NULL,
  weight REAL NOT NULL DEFAULT 10,
  stock INTEGER NOT NULL DEFAULT -1,
  active INTEGER NOT NULL DEFAULT 1,
  provider_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cracks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT,
  product_emoji TEXT,
  product_value INTEGER,
  mode TEXT NOT NULL DEFAULT 'MANUAL',
  hatched INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎁',
  value INTEGER NOT NULL DEFAULT 0,
  pin_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'READY',
  memo TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cracks_user ON cracks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_user ON rewards(user_id, created_at DESC);
-- 기프티콘 발급사 연동 원장(발급/취소 이력)
CREATE TABLE IF NOT EXISTS giftcon_issues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id TEXT REFERENCES rewards(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  tr_id TEXT,
  coupon_num TEXT,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  raw_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_reward ON giftcon_issues(reward_id);
-- 간단한 설정/상태 KV (마지막 동기화 등)
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

/** 기존 DB 파일에 신규 컬럼을 안전하게 추가 */
function ensureColumn(d: DB, table: string, column: string, ddl: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function open(): DB {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH) as DB;
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec(SCHEMA);
  // 스키마 이후 도입된 컬럼들 (이미 존재하면 스킵)
  ensureColumn(db, "products", "provider_code", "provider_code TEXT");
  ensureColumn(db, "giftcon_issues", "method", "method TEXT");
  ensureColumn(db, "users", "payout_email", "payout_email TEXT");
  return db;
}

export function getMeta(key: string): string | null {
  const row = db().prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? String(row.value) : null;
}

export function setMeta(key: string, value: string) {
  db()
    .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

declare global {
  var __GC_DB: DB | undefined;
  var __GC_SEEDED: boolean | undefined;
}

export function db(): DB {
  if (!globalThis.__GC_DB) {
    globalThis.__GC_DB = open();
    seedIfEmpty(globalThis.__GC_DB);
  }
  return globalThis.__GC_DB;
}

// ---------- mappers ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toUser(r: any): UserPublic {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    nickname: r.nickname ?? null,
    avatar: r.avatar || "🐣",
    payoutEmail: r.payout_email ?? null,
    role: r.role,
    xp: r.xp,
    credits: r.credits,
    level: levelFromXp(r.xp),
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toEgg(r: any): EggState {
  return { hp: r.hp, maxHp: r.max_hp, cycle: r.cycle, totalClicks: r.total_clicks };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    description: r.description,
    emoji: r.emoji,
    value: r.value,
    weight: r.weight,
    stock: r.stock,
    active: !!r.active,
    providerCode: r.provider_code ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toReward(r: any): Reward {
  return {
    id: r.id,
    userId: r.user_id,
    productId: r.product_id,
    title: r.title,
    brand: r.brand,
    emoji: r.emoji,
    value: r.value,
    pinCode: r.pin_code,
    status: r.status,
    memo: r.memo,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    provider: r.issue_provider ?? null,
    providerTr: r.issue_tr ?? null,
    providerStatus: r.issue_status ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCrack(r: any): Crack {
  return {
    id: r.id,
    userId: r.user_id,
    productId: r.product_id,
    productName: r.product_name,
    productEmoji: r.product_emoji,
    productValue: r.product_value,
    mode: r.mode,
    hatched: !!r.hatched,
    xp: r.xp,
    createdAt: r.created_at,
  };
}

// ---------- seed ----------

function seedIfEmpty(d: DB) {
  if (globalThis.__GC_SEEDED) return;
  const row = d.prepare("SELECT COUNT(*) AS c FROM users").get();
  if (!row || Number(row.c) > 0) {
    globalThis.__GC_SEEDED = true;
    return;
  }
  runSeed(d);
  globalThis.__GC_SEEDED = true;
}
