import { Database } from 'bun:sqlite';
import type { Administrator } from './types';

/** 包含用户名的管理员信息 */
export interface AdminWithUsername extends Administrator {
  username: string;
}

const INSERT_ADMIN = `INSERT OR IGNORE INTO administrators (user_id, promoted_at) VALUES (?, unixepoch())`;

const SELECT_ADMIN = `SELECT 1 FROM administrators WHERE user_id = ?`;

const COUNT_ADMINS = `SELECT COUNT(*) AS count FROM administrators`;

const SELECT_ALL_ADMINS = `
SELECT a.user_id, a.promoted_at, u.username
FROM administrators a
JOIN users u ON u.id = a.user_id
ORDER BY a.promoted_at DESC
`;

/**
 * 将用户提升为管理员（幂等，重复执行不报错）
 *
 * @throws 当 userId 对应的用户不存在时抛出 FOREIGN KEY 约束错误
 */
export function promoteToAdmin(db: Database, userId: number): Administrator {
  db.prepare(INSERT_ADMIN).run(userId);
  const row = db.prepare(
    'SELECT user_id, promoted_at FROM administrators WHERE user_id = ?',
  ).get(userId) as Administrator | undefined;
  return row!;
}

/**
 * 检查用户是否为管理员
 */
export function isAdmin(db: Database, userId: number): boolean {
  const row = db.prepare(SELECT_ADMIN).get(userId) as Record<string, unknown> | undefined;
  return row !== undefined;
}

/**
 * 获取管理员总数
 */
export function getAdminCount(db: Database): number {
  const row = db.prepare(COUNT_ADMINS).get() as { count: number };
  return row.count;
}

/**
 * 获取所有管理员（含用户名），按提权时间倒序排列
 */
export function getAllAdmins(db: Database): AdminWithUsername[] {
  return db.prepare(SELECT_ALL_ADMINS).all() as AdminWithUsername[];
}
