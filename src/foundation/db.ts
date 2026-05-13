import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** 数据库迁移定义 */
export type Migration = {
  name: string;
  sql: string;
};

/** _migrations 跟踪表的创建 SQL */
const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  executed_at INTEGER NOT NULL DEFAULT (unixepoch())
);`;

/**
 * 打开或创建 SQLite 数据库
 * - 支持内存数据库（path = ":memory:"）
 * - 自动创建文件数据库的父目录（无权限时降级到 .data/）
 * - 启用 WAL 模式 + 外键约束
 */
export function openDb(path: string): Database {
  // 内存数据库直接创建，无需文件系统操作
  if (path === ':memory:') {
    const db = new Database(':memory:');
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    return db;
  }

  let actualPath = path;

  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    const fileName = path.substring(path.lastIndexOf('/') + 1);
    actualPath = `.data/${fileName}`;
    console.warn(`DB: Cannot write to ${path}, falling back to ${actualPath}`);
    mkdirSync(dirname(actualPath), { recursive: true });
  }

  const db = new Database(actualPath);

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

/** 检查迁移是否已执行的 prepared statement */
const SELECT_MIGRATION = `
SELECT name FROM _migrations WHERE name = ?`;

/** 记录迁移执行的 prepared statement */
const INSERT_MIGRATION = `
INSERT INTO _migrations (name) VALUES (?)`;

/**
 * 按顺序执行数据库迁移（幂等）
 * - 使用 _migrations 表跟踪已执行的迁移
 * - 已执行的迁移自动跳过，重复运行不报错
 */
export function runMigrations(db: Database, migrations: Migration[]): void {
  // 确保跟踪表存在
  db.run(CREATE_MIGRATIONS_TABLE);

  const selectStmt = db.prepare(SELECT_MIGRATION);
  const insertStmt = db.prepare(INSERT_MIGRATION);

  for (const migration of migrations) {
    const row = selectStmt.get(migration.name) as { name: string } | null;
    if (row !== null) continue;

    db.run(migration.sql);
    insertStmt.run(migration.name);
  }
}

/** 读取设置的 prepared statement */
const SELECT_SETTING = `
SELECT value FROM settings WHERE key = ?`;

/** 写入设置的 prepared statement */
const UPSERT_SETTING = `
INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`;

/**
 * 读取系统设置
 * @returns 配置值，若 key 不存在则返回 null
 */
export function getSetting(db: Database, key: string): string | null {
  const stmt = db.prepare(SELECT_SETTING);
  const row = stmt.get(key) as { value: string } | null;
  return row?.value ?? null;
}

/**
 * 写入系统设置（存在则更新，不存在则插入）
 */
export function setSetting(db: Database, key: string, value: string): void {
  const stmt = db.prepare(UPSERT_SETTING);
  stmt.run(key, value);
}
