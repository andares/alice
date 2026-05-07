import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mockConfig } from '../../fixtures/config.mock';
import {
  ollamaChatResponse,
  ollamaTagsResponse,
  ollamaStreamChunks,
} from '../../fixtures/ollama-responses';
import { createChatCompletionRequest } from '../../fixtures/request-factories';

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

import { v1Routes } from '../../../src/routes/v1';
import { OllamaError } from '../../../src/services/ollama';

const originalFetch = globalThis.fetch;

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

beforeEach(() => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response('', { status: 200 })),
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('POST /v1/chat/completions', () => {
  it('should return 401 when no Authorization header is provided', async () => {
    const res = await v1Routes.handle(
      chatRequest({}, { 'Content-Type': 'application/json' }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.type).toBe('authentication_error');
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('should return 401 when wrong API key is provided', async () => {
    const res = await v1Routes.handle(
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
    const res = await v1Routes.handle(
      chatRequest({}, { 'Content-Type': 'application/json' }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="api"');
  });

  it('should return 200 with chat completion for valid non-streaming request', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await v1Routes.handle(chatRequest());

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
    globalThis.fetch = mock(() => Promise.resolve(createOllamaStreamResponse()));

    const res = await v1Routes.handle(chatRequest({ stream: true }));

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
    globalThis.fetch = mock(() => Promise.reject(timeoutError));

    const res = await v1Routes.handle(chatRequest());

    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.message).toBe('Upstream request timed out');
    expect(body.error.type).toBe('upstream_timeout');
    expect(body.error.code).toBe('timeout');
  });

  it('should return 502 when Ollama connection fails', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Connection refused')),
    );

    const res = await v1Routes.handle(chatRequest());

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.message).toBe('Upstream service error');
    expect(body.error.type).toBe('upstream_error');
    expect(body.error.code).toBe('upstream_failure');
  });

  it('should return 500 when Ollama returns other HTTP error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response('model not found', { status: 404, statusText: 'Not Found' }),
      ),
    );

    const res = await v1Routes.handle(chatRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.type).toBe('internal_error');
    expect(body.error.code).toBe('internal_error');
  });
});

describe('GET /v1/models', () => {
  it('should return 401 when no Authorization header is provided', async () => {
    const res = await v1Routes.handle(
      new Request('http://localhost/v1/models'),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API Key');
    expect(body.error.code).toBe('invalid_api_key');
  });

  it('should return model list for valid authenticated request', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaTagsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await v1Routes.handle(modelsRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('llama3.1:8b');
    expect(body.data[0].object).toBe('model');
    expect(body.data[0].owned_by).toBe('ollama');
    expect(body.data[1].id).toBe('qwen2.5:7b');
  });

  it('should return 502 when Ollama returns connection error', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    );

    const res = await v1Routes.handle(modelsRequest());

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.message).toBe('Upstream service error');
    expect(body.error.code).toBe('upstream_failure');
  });

  it('should return 504 when Ollama times out on models endpoint', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    globalThis.fetch = mock(() => Promise.reject(timeoutError));

    const res = await v1Routes.handle(modelsRequest());

    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.message).toBe('Upstream request timed out');
    expect(body.error.code).toBe('timeout');
  });
});
