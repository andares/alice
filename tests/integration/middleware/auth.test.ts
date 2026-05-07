import { describe, it, expect, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { authPlugin, unauthorizedError } from '../../../src/middleware/auth';
import { mockConfig } from '../../fixtures/config.mock';

// 模拟 config 模块，提供测试用的 apiKey
mock.module('../../../src/config', () => ({
  config: mockConfig,
}));

// ============================================================
// unauthorizedError 纯函数测试
// ============================================================
describe('unauthorizedError', () => {
  // 应返回正确的 OpenAI 错误响应结构
  it('should return correct OpenAI error response structure', () => {
    const result = unauthorizedError('Invalid API Key', 'invalid_api_key');

    expect(result).toHaveProperty('error');
    expect(result.error).toHaveProperty('message', 'Invalid API Key');
    expect(result.error).toHaveProperty('type', 'authentication_error');
    expect(result.error).toHaveProperty('param', null);
    expect(result.error).toHaveProperty('code', 'invalid_api_key');
  });

  // 应使用传入的 message 和 code 构造错误
  it('should use provided message and code in error object', () => {
    const result = unauthorizedError('Custom error message', 'custom_code');

    expect(result.error.message).toBe('Custom error message');
    expect(result.error.code).toBe('custom_code');
    // type 和 param 应始终固定
    expect(result.error.type).toBe('authentication_error');
    expect(result.error.param).toBeNull();
  });

  // 不同参数调用应产生不同的 message 和 code
  it('should produce different message and code for different inputs', () => {
    const a = unauthorizedError('Error A', 'code_a');
    const b = unauthorizedError('Error B', 'code_b');

    expect(a.error.message).not.toBe(b.error.message);
    expect(a.error.code).not.toBe(b.error.code);
  });
});

// ============================================================
// authPlugin 集成测试
// 使用 beforeHandle guard 模式（与 v1.ts 一致）
// ============================================================
describe('authPlugin', () => {
  // 创建使用 authPlugin 的测试应用
  // authPlugin 提供 bearer() 提取能力，通过 beforeHandle guard 执行认证检查
  const app = new Elysia()
    .use(authPlugin)
    .guard({
      beforeHandle: ({ bearer: token, set }) => {
        if (!token || token !== mockConfig.apiKey) {
          set.status = 401;
          set.headers['WWW-Authenticate'] = 'Bearer realm="api"';
          return unauthorizedError('Invalid API Key', 'invalid_api_key');
        }
      },
    }, (app) =>
      app.get('/protected', () => ({ ok: true }))
    );

  // 未提供 Bearer Token 时应返回 401
  it('should return 401 when no Bearer token is provided', async () => {
    const res = await app.handle(new Request('http://localhost/protected'));

    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.type).toBe('authentication_error');
    expect(body.error.code).toBe('invalid_api_key');
  });

  // 提供错误 Bearer Token 时应返回 401
  it('should return 401 when wrong Bearer token is provided', async () => {
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer wrong-key' },
      })
    );

    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.type).toBe('authentication_error');
    expect(body.error.code).toBe('invalid_api_key');
  });

  // 提供正确 Bearer Token 时应通过认证返回 200
  it('should return 200 when correct Bearer token is provided', async () => {
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${mockConfig.apiKey}` },
      })
    );

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  // 401 响应应包含 WWW-Authenticate 头
  it('should include WWW-Authenticate header on 401 response', async () => {
    const res = await app.handle(new Request('http://localhost/protected'));

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="api"');
  });

  // 未启用认证守卫的路由应直接返回 200
  it('should not enforce auth on routes without guard', async () => {
    const openApp = new Elysia()
      .use(authPlugin)
      .get('/public', () => ({ public: true }));

    const res = await openApp.handle(new Request('http://localhost/public'));

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ public: true });
  });
});
