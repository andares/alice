import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { Database } from 'bun:sqlite';
import type { User } from '../foundation/types';
import { registerUser, loginUser } from '../foundation/auth';
import { setAuthCookie, clearAuthCookie, elysiaAuthPlugin } from '../foundation/elysia-auth';
import { getOrCreateJwtSecret } from '../foundation/crypto';
import { createCsrfTokenForUser, deleteCsrfTokenForUser } from '../foundation/csrf';
import { isAdmin } from '../foundation/administrators';

type AuthContext = { currentUser: User | null; set: { status: number | string } };

export const authRoutes = (db: Database) =>
  new Elysia({ prefix: '/auth' })
    .use(cookie())
    .use(elysiaAuthPlugin(db))

    // POST /auth/register — 注册新用户
    .post(
      '/register',
      async ({ body, set, cookie }) => {
        const { username, password } = body as { username: string; password: string };
        try {
          const user = await registerUser(db, username, password);
          const secret = getOrCreateJwtSecret(db);
          await setAuthCookie(cookie, user, secret);
          set.status = 201;
          return { id: user.id, username: user.username };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Registration failed';
          if (message.includes('already exists')) {
            set.status = 409;
          } else if (message.includes('Username') || message.includes('Password')) {
            set.status = 400;
          } else {
            set.status = 500;
          }
          return { error: message };
        }
      },
      {
        body: t.Object({
          username: t.String({ minLength: 3, maxLength: 32 }),
          password: t.String({ minLength: 6 }),
        }),
      },
    )

    // POST /auth/login — 用户登录
    .post(
      '/login',
      async ({ body, set, cookie }) => {
        const { username, password } = body as { username: string; password: string };
        try {
          const user = await loginUser(db, username, password);
          const secret = getOrCreateJwtSecret(db);
          await setAuthCookie(cookie, user, secret);
          return { id: user.id, username: user.username };
        } catch {
          set.status = 401;
          return { error: 'Invalid credentials' };
        }
      },
      {
        body: t.Object({
          username: t.String(),
          password: t.String(),
        }),
      },
    )

    // POST /auth/logout — 清除认证 cookie
    .post('/logout', (ctx) => {
      const { currentUser, cookie } = ctx as unknown as AuthContext & { cookie: Record<string, import('elysia').Cookie<unknown>> };
      if (currentUser) {
        deleteCsrfTokenForUser(currentUser.id);
      }
      clearAuthCookie(cookie);
      return { success: true };
    })

    // GET /auth/csrf — 获取 CSRF token（需登录）
    .get('/csrf', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      if (!currentUser) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      const token = createCsrfTokenForUser(currentUser.id);
      return { csrf_token: token };
    })

    // GET /auth/me — 当前用户信息（需登录）
    .get(
      '/me',
      (ctx) => {
        const { currentUser } = ctx as unknown as AuthContext;
        const { password_hash, ...safeUser } = currentUser!;
        return {
          user: safeUser,
          isAdmin: isAdmin(db, currentUser!.id),
        };
      },
      {
        requireUser: true,
        response: t.Object({
          user: t.Object({
            id: t.Number(),
            username: t.String(),
            password_updated_at: t.Union([t.Number(), t.Null()]),
            created_at: t.Number(),
            updated_at: t.Number(),
          }),
          isAdmin: t.Boolean(),
        }),
      },
    );