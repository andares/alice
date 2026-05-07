import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { Elysia, t } from 'elysia';
import {
  initDb,
  closeDb,
  getLogs,
  getTotalCount,
} from '../../../src/services/logger-db';
import {
  logSuccessfulRequest,
  logFailedRequest,
} from '../../../src/middleware/request-logger';

/** 辅助函数：等待 setImmediate 异步写入完成 */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

describe('request-logger middleware', () => {
  let db: Database;

  beforeAll(() => {
    db = initDb(':memory:');
  });

  afterAll(() => {
    closeDb(db);
  });

  // ============================================================
  // logSuccessfulRequest 测试
  // ============================================================
  describe('logSuccessfulRequest', () => {
    it('should log /v1/* path request', async () => {
      const request = new Request('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
      });

      logSuccessfulRequest(db, request, 200, 123.5, {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      await flushAsync();

      const count = getTotalCount(db);
      expect(count).toBeGreaterThanOrEqual(1);

      const logs = getLogs(db, 1, 10);
      const entry = logs.find(
        (l) => l.path === '/v1/chat/completions' && l.method === 'POST',
      );
      expect(entry).toBeDefined();
      expect(entry!.status_code).toBe(200);
      expect(entry!.duration_ms).toBe(124); // Math.round(123.5)
      expect(entry!.request_body).not.toBeNull();
      expect(entry!.response_body).toBeNull();
    });

    it('should skip non-/v1/* path request', async () => {
      const countBefore = getTotalCount(db);

      const request = new Request('http://localhost:3000/alice/status', {
        method: 'GET',
      });

      logSuccessfulRequest(db, request, 200, 50, null);
      await flushAsync();

      const countAfter = getTotalCount(db);
      expect(countAfter).toBe(countBefore);
    });

    it('should truncate long request body over 10KB', async () => {
      // 构造超过 10KB 的请求体
      const longBody = 'x'.repeat(10241);
      const request = new Request('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
      });

      logSuccessfulRequest(db, request, 200, 80, longBody);
      await flushAsync();

      const logs = getLogs(db, 1, 50);
      const entry = logs.find(
        (l) => l.path === '/v1/chat/completions' && l.duration_ms === 80,
      );
      expect(entry).toBeDefined();
      expect(entry!.request_body).not.toBeNull();
      // 截断后应包含 [truncated 提示
      expect(entry!.request_body).toContain('[truncated');
    });

    it('should handle object body by serializing to JSON', async () => {
      const body = { model: 'llama3', messages: [{ role: 'user', content: 'Hi' }] };
      const request = new Request('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
      });

      logSuccessfulRequest(db, request, 200, 45, body);
      await flushAsync();

      const logs = getLogs(db, 1, 50);
      const entry = logs.find(
        (l) => l.path === '/v1/chat/completions' && l.duration_ms === 45,
      );
      expect(entry).toBeDefined();
      expect(entry!.request_body).not.toBeNull();
      // 应为合法 JSON 字符串
      const parsed = JSON.parse(entry!.request_body!);
      expect(parsed.model).toBe('llama3');
      expect(parsed.messages).toHaveLength(1);
    });

    it('should serialize non-streaming response body when provided', async () => {
      const request = new Request('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
      });

      logSuccessfulRequest(
        db,
        request,
        200,
        33,
        { model: 'llama3' },
        { id: 'chatcmpl-1', object: 'chat.completion' },
      );
      await flushAsync();

      const logs = getLogs(db, 1, 50);
      const entry = logs.find(
        (l) => l.path === '/v1/chat/completions' && l.duration_ms === 33,
      );
      expect(entry).toBeDefined();
      expect(entry!.response_body).not.toBeNull();
      expect(JSON.parse(entry!.response_body!)).toEqual({
        id: 'chatcmpl-1',
        object: 'chat.completion',
      });
    });
  });

  // ============================================================
  // logFailedRequest 测试
  // ============================================================
  describe('logFailedRequest', () => {
    it('should log /v1/* path failed request', async () => {
      const request = new Request('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
      });

      logFailedRequest(db, request, 500, 200.7, { model: 'gpt-4' }, { error: 'boom' });
      await flushAsync();

      const logs = getLogs(db, 1, 50);
      const entry = logs.find(
        (l) => l.path === '/v1/chat/completions' && l.status_code === 500,
      );
      expect(entry).toBeDefined();
      expect(entry!.method).toBe('POST');
      expect(entry!.status_code).toBe(500);
      expect(entry!.duration_ms).toBe(201); // Math.round(200.7)
      expect(JSON.parse(entry!.request_body!)).toEqual({ model: 'gpt-4' });
      expect(JSON.parse(entry!.response_body!)).toEqual({ error: 'boom' });
    });

    it('should skip non-/v1/* path failed request', async () => {
      const countBefore = getTotalCount(db);

      const request = new Request('http://localhost:3000/alice/config', {
        method: 'GET',
      });

      logFailedRequest(db, request, 404, 10);
      await flushAsync();

      const countAfter = getTotalCount(db);
      expect(countAfter).toBe(countBefore);
    });
  });

  // ============================================================
  // Elysia 生命周期接线测试
  // ============================================================
  describe('Elysia lifecycle wiring', () => {
    it('should persist request and response bodies from onAfterHandle', async () => {
      const app = new Elysia()
        .onAfterHandle(({ request, body, response }) => {
          logSuccessfulRequest(db, request, 200, 12, body, response);
        })
        .post('/v1/test-success', ({ body }) => ({ ok: true, echoed: body }), {
          body: t.Object({ message: t.String() }),
        });

      await app.handle(new Request('http://localhost/v1/test-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      }));
      await flushAsync();

      const logs = getLogs(db, 1, 50);
      const entry = logs.find((l) => l.path === '/v1/test-success');
      expect(entry).toBeDefined();
      expect(JSON.parse(entry!.request_body!)).toEqual({ message: 'hello' });
      expect(JSON.parse(entry!.response_body!)).toEqual({
        ok: true,
        echoed: { message: 'hello' },
      });
    });

    it('should persist request and error bodies from onError', async () => {
      const app = new Elysia()
        .onError(({ request, body }) => {
          const errorResponse = { error: { message: 'boom' } };
          logFailedRequest(db, request, 500, 9, body, errorResponse);
          return errorResponse;
        })
        .post('/v1/test-error', ({ body }) => {
          throw new Error(`fail:${body.message}`);
        }, {
          body: t.Object({ message: t.String() }),
        });

      await app.handle(new Request('http://localhost/v1/test-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      }));
      await flushAsync();

      const logs = getLogs(db, 1, 50);
      const entry = logs.find((l) => l.path === '/v1/test-error');
      expect(entry).toBeDefined();
      expect(JSON.parse(entry!.request_body!)).toEqual({ message: 'hello' });
      expect(JSON.parse(entry!.response_body!)).toEqual({
        error: { message: 'boom' },
      });
    });
  });
});
