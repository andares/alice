import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { Database } from 'bun:sqlite';
import { authPlugin, unauthorizedError } from '../../../src/middleware/auth';

// 测试用 API Key
const TEST_API_KEY = 'sk-test-for-integration-abc123';

// ============================================================
// 辅助：创建含 api_keys 表和预置密钥的内存数据库
// ============================================================
async function createTestDb(): Promise<Database> {
  const db = new Database(':memory:');
  db.run('PRAGMA journal_mode = WAL');

  db.run(`
    CREATE TABLE api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);

  const hash = await Bun.password.hash(TEST_API_KEY, { algorithm: 'bcrypt', cost: 10 });
  const prefix = TEST_API_KEY.slice(0, 7);
  db.run(
    'INSERT INTO api_keys (key_hash, key_prefix, description) VALUES (?, ?, ?)',
    [hash, prefix, 'Test key'],
  );

  return db;
}

// ============================================================
// unauthorizedError 纯函数测试
// ============================================================
describe('unauthorizedError', () => {
  it('should return correct OpenAI error response structure', () => {
    const result = unauthorizedError('Invalid API Key', 'invalid_api_key');

    expect(result).toHaveProperty('error');
    expect(result.error).toHaveProperty('message', 'Invalid API Key');
    expect(result.error).toHaveProperty('type', 'invalid_request_error');
    expect(result.error).toHaveProperty('param', null);
    expect(result.error).toHaveProperty('code', 'invalid_api_key');
  });

  it('should use provided message and code in error object', () => {
    const result = unauthorizedError('Custom error message', 'custom_code');

    expect(result.error.message).toBe('Custom error message');
    expect(result.error.code).toBe('custom_code');
    expect(result.error.type).toBe('invalid_request_error');
    expect(result.error.param).toBeNull();
  });

  it('should produce different message and code for different inputs', () => {
    const a = unauthorizedError('Error A', 'code_a');
    const b = unauthorizedError('Error B', 'code_b');

    expect(a.error.message).not.toBe(b.error.message);
    expect(a.error.code).not.toBe(b.error.code);
  });
});

// ============================================================
// authPlugin 集成测试（bcrypt 多 Key 验证）
// 使用 beforeHandle guard 模式（与 v1.ts 一致）
// ============================================================
function makeAuthGuard() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeHandle: (ctx: any) => {
      if (!ctx.isAuthenticated) {
        ctx.set.status = 401;
        ctx.set.headers['WWW-Authenticate'] = 'Bearer realm="api"';
        return unauthorizedError('Invalid API Key', 'invalid_api_key');
      }
    },
  };
}

describe('authPlugin with bcrypt multi-key', () => {
  it('should return 401 when no Bearer token is provided', async () => {
    const db = await createTestDb();
    const app = new Elysia()
      .use(authPlugin(db))
      .guard(makeAuthGuard(), (app) =>
        app.get('/protected', () => ({ ok: true })),
      );

    const res = await app.handle(new Request('http://localhost/protected'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.code).toBe('invalid_api_key');
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="api"');
  });

  it('should return 401 when wrong Bearer token is provided', async () => {
    const db = await createTestDb();
    const app = new Elysia()
      .use(authPlugin(db))
      .guard(makeAuthGuard(), (app) =>
        app.get('/protected', () => ({ ok: true })),
      );

    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer wrong-key' },
      }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('should return 200 when correct Bearer token is provided', async () => {
    const db = await createTestDb();
    const app = new Elysia()
      .use(authPlugin(db))
      .guard(makeAuthGuard(), (app) =>
        app.get('/protected', () => ({ ok: true })),
      );

    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('should include WWW-Authenticate header on 401 response', async () => {
    const db = await createTestDb();
    const app = new Elysia()
      .use(authPlugin(db))
      .guard(makeAuthGuard(), (app) =>
        app.get('/protected', () => ({ ok: true })),
      );

    const res = await app.handle(new Request('http://localhost/protected'));

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="api"');
  });

  it('should not enforce auth on routes without guard', async () => {
    const db = await createTestDb();
    const app = new Elysia()
      .use(authPlugin(db))
      .get('/public', () => ({ public: true }));

    const res = await app.handle(new Request('http://localhost/public'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ public: true });
  });

  it('should support multiple active keys', async () => {
    const db = new Database(':memory:');
    db.run('PRAGMA journal_mode = WAL');
    db.run(`
      CREATE TABLE api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        is_active INTEGER NOT NULL DEFAULT 1
      )
    `);

    const key1 = 'sk-key-one-aaaaaaaaaaaaaaaaaaaaaa';
    const key2 = 'sk-key-two-bbbbbbbbbbbbbbbbbbbbbb';
    for (const key of [key1, key2]) {
      const hash = await Bun.password.hash(key, { algorithm: 'bcrypt', cost: 10 });
      const prefix = key.slice(0, 7);
      db.run(
        'INSERT INTO api_keys (key_hash, key_prefix, description) VALUES (?, ?, ?)',
        [hash, prefix, `Key ${key.slice(0, 10)}`],
      );
    }

    const app = new Elysia()
      .use(authPlugin(db))
      .guard(makeAuthGuard(), (app) =>
        app.get('/protected', () => ({ ok: true })),
      );

    // key1 应该通过
    const res1 = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${key1}` },
      }),
    );
    expect(res1.status).toBe(200);

    // key2 也应该通过
    const res2 = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${key2}` },
      }),
    );
    expect(res2.status).toBe(200);

    // 错误的 key 应该被拒绝
    const res3 = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer sk-bad-key-xxxxxxxxxxxx' },
      }),
    );
    expect(res3.status).toBe(401);
  });
});
