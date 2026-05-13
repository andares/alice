/**
 * API Key 管理模块
 *
 * 提供 API Key 的完整生命周期管理：
 * - 生成（sk- + 48 hex 字符）
 * - bcrypt 哈希存储
 * - 验证、列表、停用、删除
 *
 * 数据库仅存 bcrypt 哈希，不存储完整明文密钥。
 */

import { Database } from 'bun:sqlite';
import { generateApiKey, hashApiKey, verifyApiKey } from './crypto';
import type { ApiKey } from './types';

/** api_keys 表创建 SQL（用于迁移系统注册） */
export const CREATE_API_KEYS_TABLE = `
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_active INTEGER NOT NULL DEFAULT 1
);`;

/** createApiKey 返回值 */
export interface CreateApiKeyResult {
  /** 完整明文密钥（仅在创建时返回一次） */
  plaintext: string;
  /** 已入库的密钥记录 */
  record: ApiKey;
}

/**
 * 创建新的 API Key
 *
 * 生成 sk- + 48 hex 字符的密钥，bcrypt 哈希后存储。
 * 完整明文仅在返回值中提供一次，请及时告知用户。
 *
 * @param db         数据库实例
 * @param description 密钥描述/备注（可选）
 * @returns 包含明文密钥和数据库记录的对象
 */
export async function createApiKey(
  db: Database,
  description?: string,
): Promise<CreateApiKeyResult> {
  const plaintext = generateApiKey();
  const keyHash = await hashApiKey(plaintext);
  const keyPrefix = plaintext.slice(0, 7);

  const stmt = db.prepare(`
    INSERT INTO api_keys (key_hash, key_prefix, description)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(keyHash, keyPrefix, description ?? null);

  return {
    plaintext,
    record: {
      id: result.lastInsertRowid as number,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      description: description ?? null,
      created_at: Math.floor(Date.now() / 1000),
      is_active: 1,
    },
  };
}

/**
 * 验证 API Key 是否有效
 *
 * 遍历所有活跃的 key，逐条使用 bcrypt 比对。
 * 命中第一个匹配即返回 true。
 *
 * @param db       数据库实例
 * @param keyValue 待验证的完整密钥
 * @returns 是否通过验证
 */
export async function validateApiKey(
  db: Database,
  keyValue: string,
): Promise<boolean> {
  const rows = db
    .prepare('SELECT key_hash FROM api_keys WHERE is_active = 1')
    .all() as Pick<ApiKey, 'key_hash'>[];

  for (const row of rows) {
    if (await verifyApiKey(row.key_hash, keyValue)) {
      return true;
    }
  }

  return false;
}

/**
 * 列出所有 API Key
 *
 * 返回完整列表（不含 key_hash 字段，仅含 key_prefix 用于 UI 展示）。
 *
 * @param db 数据库实例
 * @returns 密钥列表，按创建时间降序排列
 */
export function listApiKeys(db: Database): Omit<ApiKey, 'key_hash'>[] {
  return db
    .prepare(
      `
      SELECT id, key_prefix, description, created_at, is_active
      FROM api_keys
      ORDER BY created_at DESC
    `,
    )
    .all() as Omit<ApiKey, 'key_hash'>[];
}

/**
 * 停用 API Key
 *
 * 将 is_active 置为 0，已停用的 key 无法通过验证。
 *
 * @param db 数据库实例
 * @param id 密钥 ID
 */
export function deactivateApiKey(db: Database, id: number): void {
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(id);
}

/**
 * 删除 API Key
 *
 * 从数据库中物理删除密钥记录。
 *
 * @param db 数据库实例
 * @param id 密钥 ID
 */
export function deleteApiKey(db: Database, id: number): void {
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
}
