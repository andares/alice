/**
 * CSRF 保护模块 —— 生成、存储、验证 CSRF token
 *
 * 采用 Double Submit Cookie 模式的变体：
 * - JWT 存储在 HttpOnly cookie 中（不可被 JS 读取）
 * - CSRF token 通过 X-CSRF-Token header 传递
 * - 两者结合提供双重保护
 *
 * Token 存储使用内存 Map（userId → token），
 * 服务重启后 token 自动失效，客户端需重新获取。
 */

import { Elysia } from 'elysia';
import type { Database } from 'bun:sqlite';
import { generateCsrfToken, validateCsrfToken } from './crypto';
import type { User } from './types';

// ── Re-export ────────────────────────────────────────────────────────

export { generateCsrfToken, validateCsrfToken };

// ── Token 存储 ──────────────────────────────────────────────────────

const csrfTokenStore = new Map<number, string>();

// ── Token 管理函数 ───────────────────────────────────────────────────

/** 为用户生成并存储 CSRF token（单 token 模式，覆盖旧值） */
export function createCsrfTokenForUser(userId: number): string {
  const token = generateCsrfToken();
  csrfTokenStore.set(userId, token);
  return token;
}

export function getCsrfTokenForUser(userId: number): string | undefined {
  return csrfTokenStore.get(userId);
}

/** 验证 CSRF token（时序安全比较，防止 timing attack） */
export function verifyCsrfToken(userId: number, token: string): boolean {
  const stored = csrfTokenStore.get(userId);
  if (!stored) return false;
  return validateCsrfToken(token, stored);
}

export function deleteCsrfTokenForUser(userId: number): void {
  csrfTokenStore.delete(userId);
}

// ── Elysia 中间件 ────────────────────────────────────────────────────

/**
 * CSRF 保护中间件
 *
 * 对 POST/PUT/DELETE 请求验证 X-CSRF-Token header。
 * 仅当 currentUser 存在（即已认证用户）时才验证；
 * 未认证请求由 requireUser 宏负责拦截。
 *
 * 前置依赖：必须先应用 elysiaAuthPlugin 以提供 currentUser。
 *
 * @param db 数据库实例（预留，当前使用内存存储）
 */
export function csrfMiddleware(_db: Database) {
  return new Elysia({ name: 'csrf' })
    .onBeforeHandle((context) => {
      const { request, set } = context;
      const method = request.method.toUpperCase();
      if (!['POST', 'PUT', 'DELETE'].includes(method)) return;

      // currentUser 由 elysiaAuthPlugin 的 derive 提供
      const currentUser = (context as unknown as { currentUser: User | null }).currentUser;
      if (!currentUser) return;

      const token = request.headers.get('x-csrf-token');
      if (!token || !verifyCsrfToken(currentUser.id, token)) {
        set.status = 403;
        return { error: 'Invalid CSRF token' };
      }
    });
}