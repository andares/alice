import { Elysia } from 'elysia';
import type { Cookie } from 'elysia';
import { Database } from 'bun:sqlite';
import type { User } from './types';
import { getOrCreateJwtSecret, signJwt, verifyJwt } from './crypto';
import { getUserById } from './users';
import { isAdmin } from './administrators';

const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 604800;
const JWT_TTL_SECONDS = 604800;

type CookieJar = Record<string, Cookie<unknown>>;

export async function setAuthCookie(
  cookie: CookieJar,
  user: User,
  secret: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    {
      sub: String(user.id),
      username: user.username,
      iat: now,
      exp: now + JWT_TTL_SECONDS,
    },
    secret,
  );
  cookie[COOKIE_NAME].set({
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearAuthCookie(cookie: CookieJar): void {
  cookie[COOKIE_NAME].remove();
}

export function elysiaAuthPlugin(db: Database) {
  const jwtSecret = getOrCreateJwtSecret(db);

  return new Elysia({ name: 'user-auth' })
    .derive({ as: 'scoped' }, async ({ cookie }) => {
      const token = cookie[COOKIE_NAME]?.value as string | undefined;
      let currentUser: User | null = null;

      if (token && typeof token === 'string') {
        try {
          const payload = await verifyJwt(token, jwtSecret);
          if (payload.sub) {
            currentUser = getUserById(db, Number(payload.sub));
          }
        } catch {
          cookie[COOKIE_NAME].remove();
        }
      }

      return { currentUser } as { currentUser: User | null };
    })
    .macro({
      requireUser: (enabled: boolean) => {
        if (!enabled) return;
        return {
          beforeHandle(ctx: { currentUser: User | null; set: { status: number | string } }) {
            if (!ctx.currentUser) {
              ctx.set.status = 401;
              return { error: 'Unauthorized' };
            }
          },
        } as any;
      },
      requireAdmin: (enabled: boolean) => {
        if (!enabled) return;
        return {
          beforeHandle(ctx: { currentUser: User | null; set: { status: number | string } }) {
            if (!ctx.currentUser) {
              ctx.set.status = 403;
              return { error: 'Forbidden' };
            }
            if (!isAdmin(db, ctx.currentUser.id)) {
              ctx.set.status = 403;
              return { error: 'Forbidden' };
            }
          },
        } as any;
      },
    });
}
