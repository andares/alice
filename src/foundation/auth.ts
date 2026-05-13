/**
 * Foundation 认证服务模块 —— 注册、登录业务逻辑
 *
 * 不直接处理 HTTP 请求/响应，仅封装纯业务逻辑。
 */

import { Database } from 'bun:sqlite';
import type { User } from './types';
import { hashPassword, verifyPassword } from './crypto';
import { createUser, getUserByUsername } from './users';

// ── 验证器 ──────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

/**
 * 校验用户名合法性
 * - 长度 3-32 字符
 * - 仅允许字母、数字、下划线
 *
 * @throws 格式不合法时抛出 Error
 */
export function validateUsername(username: string): void {
  if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
    throw new Error('Username must be between 3 and 32 characters');
  }
  if (!USERNAME_RE.test(username)) {
    throw new Error('Username can only contain letters, numbers, and underscores');
  }
}

/**
 * 校验密码强度
 * - 长度不少于 6 字符
 *
 * @throws 格式不合法时抛出 Error
 */
export function validatePassword(password: string): void {
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
}

// ── 注册 ────────────────────────────────────────────────────────────

/**
 * 注册新用户
 *
 * 流程：校验用户名 → 校验密码 → 查重 → 哈希密码 → 创建用户
 *
 * @returns 完整 User 对象
 * @throws 用户名已存在时抛出错误
 */
export async function registerUser(
  db: Database,
  username: string,
  password: string,
): Promise<User> {
  validateUsername(username);
  validatePassword(password);

  const existing = getUserByUsername(db, username);
  if (existing) {
    throw new Error('Username already exists');
  }

  const passwordHash = await hashPassword(password);
  return createUser(db, username, passwordHash);
}

// ── 登录 ────────────────────────────────────────────────────────────

/**
 * 用户登录
 *
 * 流程：查用户 → 验证密码 → 返回 user
 *
 * 出于安全考虑，用户名不存在和密码错误均返回 "Invalid credentials"，
 * 不泄露用户是否存在。
 *
 * @returns 完整 User 对象
 * @throws 认证失败时抛出 Error
 */
export async function loginUser(
  db: Database,
  username: string,
  password: string,
): Promise<User> {
  const user = getUserByUsername(db, username);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  return user;
}

// ── 密码策略 ────────────────────────────────────────────────────────

/**
 * 判断用户是否需要修改密码
 *
 * @returns password_updated_at 为 null 时返回 true（从未修改过密码）
 */
export function isPasswordChangeRequired(user: User): boolean {
  return user.password_updated_at === null;
}
