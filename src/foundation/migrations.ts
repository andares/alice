import type { Migration } from './db';

/**
 * 所有数据库迁移定义
 *
 * 迁移命名约定：
 * - `alice_XXX_*` — 应用于 alice.db（主数据库）
 * - `chat_XXX_*` — 应用于 chat.db（聊天数据库，独立）
 *
 * 使用方式：
 *   import { getMigrations } from './foundation/migrations';
 *   const migrations = getMigrations();
 *   // 按数据库过滤
 *   const aliceMigrations = migrations.filter(m => m.db === 'alice');
 *   const chatMigrations = migrations.filter(m => m.db === 'chat');
 *   // 分别执行
 *   runMigrations(aliceDb, aliceMigrations);
 *   runMigrations(chatDb, chatMigrations);
 */

interface MigrationEntry extends Migration {
  db: 'alice' | 'chat';
}

const USERS = `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_updated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);`;

const ADMINISTRATORS = `CREATE TABLE IF NOT EXISTS administrators (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  promoted_at INTEGER NOT NULL DEFAULT (unixepoch())
);`;

const API_KEYS = `CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_active INTEGER NOT NULL DEFAULT 1
);`;

const ROUTER_MODELS = `CREATE TABLE IF NOT EXISTS router_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  variant TEXT NOT NULL DEFAULT 'openai',
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT,
  options TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);`;

const ASSISTORS = `CREATE TABLE IF NOT EXISTS assistors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);`;

const SETTINGS = `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);`;

const CHAT_CONVERSATIONS_USER_ID = `ALTER TABLE conversations ADD COLUMN user_id INTEGER;`;

const CHAT_MESSAGES_USER_ID = `ALTER TABLE messages ADD COLUMN user_id INTEGER;`;

/**
 * 返回所有数据库迁移（按执行顺序排列）
 *
 * - alice.db 迁移：先建依赖表（users → administrators → api_keys →
 *   router_models → assistors → settings）
 * - chat.db 迁移：添加 user_id 列（conversations → messages）
 *
 * 迁移通过 _migrations 表跟踪执行状态，已执行的自动跳过（幂等）。
 * 调用方需按 db 字段过滤后分别传入对应数据库的 runMigrations()。
 */
export function getMigrations(): MigrationEntry[] {
  return [
    // ===== alice.db 迁移 =====
    { name: 'alice_001_users', sql: USERS, db: 'alice' },
    { name: 'alice_002_administrators', sql: ADMINISTRATORS, db: 'alice' },
    { name: 'alice_003_api_keys', sql: API_KEYS, db: 'alice' },
    { name: 'alice_004_router_models', sql: ROUTER_MODELS, db: 'alice' },
    { name: 'alice_005_assistors', sql: ASSISTORS, db: 'alice' },
    { name: 'alice_006_settings', sql: SETTINGS, db: 'alice' },

    // ===== chat.db 迁移 =====
    { name: 'chat_001_conversations_user_id', sql: CHAT_CONVERSATIONS_USER_ID, db: 'chat' },
    { name: 'chat_002_messages_user_id', sql: CHAT_MESSAGES_USER_ID, db: 'chat' },
  ];
}
