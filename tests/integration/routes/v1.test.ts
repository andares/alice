import { describe, it, expect, mock, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mockConfig } from '../../fixtures/config.mock';
import {
  ollamaChatResponse,
  ollamaTagsResponse,
  ollamaStreamChunks,
} from '../../fixtures/ollama-responses';
import { createChatCompletionRequest } from '../../fixtures/request-factories';
import { hashPassword } from '../../../src/foundation/crypto';

const testLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  flush: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
};

// mock.module 必须在导入被测模块之前调用，否则模块会使用真实实现
mock.module('../../../src/config', () => ({
  config: mockConfig,
}));

mock.module('../../../src/utils/logger', () => ({
  getDefaultLogger: mock(() => testLogger),
  setDefaultLogger: mock(() => {}),
}));

import { createV1Routes } from '../../../src/routes/v1';
import { OllamaError } from '../../../src/services/ollama';

/** 创建满足 Bun typeof fetch 类型（含 preconnect）的 mock fetch */
function mockFetch(impl: () => Promise<Response>): typeof fetch {
  const m = mock(impl);
  return Object.assign(m, { preconnect() {} }) as typeof fetch;
}

const originalFetch = globalThis.fetch;

let db: Database;
let app: ReturnType<typeof createV1Routes>;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${mockConfig.apiKey}`,
    ...extra,
  };
}

function chatRequest(
  overrides: Record<string, unknown> = {},
  headers?: Record<string, string>,
): Request {
  return new Request('http://localhost/v1/chat/completions', {
    method: 'POST',
    headers: headers ?? authHeaders(),
    body: JSON.stringify(createChatCompletionRequest(overrides)),
  });
}

function modelsRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost/v1/models', {
    headers: headers ?? authHeaders(),
  });
}

// 创建 Ollama NDJSON 流式响应
function createOllamaStreamResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of ollamaStreamChunks) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

beforeAll(async () => {
  db = new Database(':memory:');
  db.run('PRAGMA journal_mode = WAL');
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS router_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      variant TEXT NOT NULL DEFAULT 'openai',
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key TEXT,
      options TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  const keyHash = await hashPassword(mockConfig.apiKey);
  db.prepare(
    'INSERT INTO api_keys (key_hash, key_prefix, description) VALUES (?, ?, ?)',
  ).run(keyHash, mockConfig.apiKey.slice(0, 7), 'test key');
  // 插入默认 Ollama 路由（测试用）
  db.prepare(
    "INSERT INTO router_models (name, variant, base_url, model, api_key) VALUES ('__default__', 'ollama', ?, '', NULL)",
  ).run(mockConfig.ollamaUrl);
  app = createV1Routes(db);
});

afterAll(() => {
  db?.close();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('POST /v1/chat/completions', () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(new Response('', { status: 200 })),
    );
  });

  it('should return 401 when no Authorization header is provided', async () => {
    const res = await app.handle(
      chatRequest({}, { 'Content-Type': 'application/json' }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('should return 401 when wrong API key is provided', async () => {
    const res = await app.handle(
      chatRequest(
        {},
        {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-key',
        },
      ),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('should include WWW-Authenticate header on 401 response', async () => {
    const res = await app.handle(
      chatRequest({}, { 'Content-Type': 'application/json' }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="api"');
  });

  it('should return 200 with chat completion for valid non-streaming request', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await app.handle(chatRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('gpt-4');
    expect(body.choices).toHaveLength(1);
    expect(body.choices[0].message.role).toBe('assistant');
    expect(body.choices[0].message.content).toBe(
      'Hello! How can I help you today?',
    );
    expect(body.choices[0].finish_reason).toBe('stop');
    expect(body.usage).toBeDefined();
    expect(body.usage.total_tokens).toBeGreaterThanOrEqual(0);
  });

  it('should return streaming SSE response when stream is true', async () => {
    globalThis.fetch = mockFetch(() => Promise.resolve(createOllamaStreamResponse()));

    const res = await app.handle(chatRequest({ stream: true }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');

    const text = await res.text();
    expect(text).toContain('data: ');
    expect(text).toContain('[DONE]');
  });

  it('should return 504 when Ollama times out', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    globalThis.fetch = mockFetch(() => Promise.reject(timeoutError));

    const res = await app.handle(chatRequest());

    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.message).toBe('Upstream request timed out');
    expect(body.error.type).toBe('upstream_timeout');
    expect(body.error.code).toBe('timeout');
  });

it('should return 502 when Ollama connection fails', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.reject(new Error('Connection refused')),
    );

    const res = await app.handle(chatRequest());

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.message).toBe('Upstream connection failed: Connection refused');
    expect(body.error.type).toBe('upstream_error');
    expect(body.error.code).toBe('upstream_failure');
  });

  it('should return upstream error when Ollama returns HTTP error', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response('model not found', { status: 404, statusText: 'Not Found' }),
      ),
    );

    const res = await app.handle(chatRequest());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toBe('Ollama error: 404 Not Found');
    expect(body.error.type).toBe('upstream_error');
    expect(body.error.code).toBe('upstream_failure');
  });
});

describe('GET /v1/models', () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(new Response('', { status: 200 })),
    );
  });

  it('should return 401 when no Authorization header is provided', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/models'),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('should return model list for valid authenticated request', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaTagsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await app.handle(modelsRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('llama3.1:8b');
    expect(body.data[0].object).toBe('model');
    expect(body.data[0].owned_by).toBe('ollama');
    expect(body.data[1].id).toBe('qwen2.5:7b');
  });

it('should return router models only when Ollama is unreachable', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    );

    const res = await app.handle(modelsRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    // __default__ 被过滤，Ollama 不可达时只返回 router models（此处为空）
    expect(body.data).toHaveLength(0);
  });

  it('should return router models only when Ollama times out', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    globalThis.fetch = mockFetch(() => Promise.reject(timeoutError));

    const res = await app.handle(modelsRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    expect(body.data).toHaveLength(0);
  });
});
