import { Database } from 'bun:sqlite';
import type { User } from './types';

const INSERT_USER = `
INSERT INTO users (username, password_hash)
VALUES (?, ?)
RETURNING *`;

const SELECT_BY_ID = `
SELECT * FROM users WHERE id = ?`;

const SELECT_BY_USERNAME = `
SELECT * FROM users WHERE username = ?`;

const UPDATE_PASSWORD = `
UPDATE users
SET password_hash = ?, password_updated_at = unixepoch(), updated_at = unixepoch()
WHERE id = ?`;

/**
 * 创建新用户
 * @returns 完整 User 对象
 */
export function createUser(db: Database, username: string, passwordHash: string): User {
  const stmt = db.prepare<Pick<User, 'id' | 'username' | 'password_hash' | 'password_updated_at' | 'created_at' | 'updated_at'>, [string, string]>(INSERT_USER);
  return stmt.get(username, passwordHash) as User;
}

/**
 * 按 ID 查询用户
 * @returns User 对象，不存在则返回 null
 */
export function getUserById(db: Database, id: number): User | null {
  const stmt = db.prepare<Pick<User, 'id' | 'username' | 'password_hash' | 'password_updated_at' | 'created_at' | 'updated_at'>, [number]>(SELECT_BY_ID);
  const row = stmt.get(id);
  return row as User | null;
}

/**
 * 按用户名查询用户
 * @returns User 对象，不存在则返回 null
 */
export function getUserByUsername(db: Database, username: string): User | null {
  const stmt = db.prepare<Pick<User, 'id' | 'username' | 'password_hash' | 'password_updated_at' | 'created_at' | 'updated_at'>, [string]>(SELECT_BY_USERNAME);
  const row = stmt.get(username);
  return row as User | null;
}

/**
 * 更新用户密码
 * 自动维护 password_hash、password_updated_at 和 updated_at 字段
 */
export function updatePassword(db: Database, userId: number, newHash: string): void {
  const stmt = db.prepare(UPDATE_PASSWORD);
  stmt.run(newHash, userId);
}
