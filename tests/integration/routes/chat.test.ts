import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { initChatDb, closeChatDb } from '../../../src/services/chat-db';
import { signJwt, hashPassword, getOrCreateJwtSecret } from '../../../src/foundation/crypto';

// ── Mock fixtures ──

const chatConfig = {
  port: 3000,
  apiKey: 'sk-test',
  ollamaUrl: 'http://127.0.0.1:11434',
  logLevel: 'info' as const,
  logFile: './logs/test.log',
  dbFile: ':memory:',
  chatDbFile: ':memory:',
  modelAliases: {} as Record<string, string>,
};

const testLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  flush: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
};

// mock.module 必须在导入被测模块之前调用
mock.module('../../../src/config', () => ({
  config: chatConfig,
}));

mock.module('../../../src/utils/logger', () => ({
  getDefaultLogger: mock(() => testLogger),
  setDefaultLogger: mock(() => {}),
}));

import { chatRoutes } from '../../../src/routes/chat';
import {
  ollamaChatResponse,
  ollamaStreamChunks,
  ollamaTagsResponse,
} from '../../fixtures/ollama-responses';
import type { OllamaStreamChunk } from '../../../src/types';

const originalFetch = globalThis.fetch;

function mockFetch(fn: () => Promise<Response>): typeof fetch {
  const mocked = mock(fn);
  return Object.assign(mocked, { preconnect: undefined }) as unknown as typeof fetch;
}

function mockFetchReject(fn: () => Promise<never>): typeof fetch {
  const mocked = mock(fn);
  return Object.assign(mocked, { preconnect: undefined }) as unknown as typeof fetch;
}

// ── 测试辅助函数 ──

/** 创建测试用 alice 内存数据库（含 users、administrators、settings、assistors 表） */
function createAliceDb(): Database {
  const db = new Database(':memory:');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_updated_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS administrators (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      promoted_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS assistors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  return db;
}

/** 创建测试用 chat 内存数据库 */
function createChatDb(): Database {
  return initChatDb(':memory:');
}

/** 创建测试用户并返回 JWT token */
async function createTestUser(aliceDb: Database): Promise<{ userId: number; token: string; cookie: string }> {
  const passwordHash = await hashPassword('testpassword');
  const result = aliceDb.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id',
  ).get('testuser', passwordHash) as { id: number };

  const userId = result.id;
  const secret = getOrCreateJwtSecret(aliceDb);

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    { sub: String(userId), username: 'testuser', iat: now, exp: now + 86400 },
    secret,
  );

  return { userId, token, cookie: `auth_token=${token}` };
}

/** 创建 Ollama NDJSON 流式响应 */
function createOllamaStreamResponse(chunks?: OllamaStreamChunk[]): Response {
  const encoder = new TextEncoder();
  const data = chunks ?? ollamaStreamChunks;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of data) {
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

/** 创建 POST /chat/api/chat 请求 */
function chatRequestBody(body: Record<string, unknown>, cookie: string): Request {
  return new Request('http://localhost/chat/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(body),
  });
}

/** 创建 GET /chat/api/conversations 请求 */
function conversationsRequest(cookie: string): Request {
  return new Request('http://localhost/chat/api/conversations', {
    headers: { 'Cookie': cookie },
  });
}

/** 创建 GET /chat/api/conversations/:id/messages 请求 */
function messagesRequest(convId: string, cookie: string): Request {
  return new Request(
    `http://localhost/chat/api/conversations/${convId}/messages`,
    { headers: { 'Cookie': cookie } },
  );
}

/** 创建 PUT /chat/api/conversations/:id/title 请求 */
function renameRequest(convId: string, title: string, cookie: string): Request {
  return new Request(
    `http://localhost/chat/api/conversations/${convId}/title`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ title }),
    },
  );
}

/** 创建 DELETE /chat/api/conversations/:id 请求 */
function deleteRequest(convId: string, cookie: string): Request {
  return new Request(
    `http://localhost/chat/api/conversations/${convId}`,
    {
      method: 'DELETE',
      headers: { 'Cookie': cookie },
    },
  );
}

/** 创建 GET /chat/api/models 请求 */
function modelsRequestChat(cookie: string): Request {
  return new Request('http://localhost/chat/api/models', {
    headers: { 'Cookie': cookie },
  });
}

// ── 全局测试状态 ──

let chatDb: Database;
let aliceDb: Database;
let app: ReturnType<typeof chatRoutes>;
let auth: { userId: number; token: string; cookie: string };

beforeEach(async () => {
  chatDb = createChatDb();
  aliceDb = createAliceDb();
  auth = await createTestUser(aliceDb);
  app = chatRoutes(chatDb, aliceDb);
  globalThis.fetch = mockFetch(() =>
    Promise.resolve(new Response('', { status: 200 })),
  );
});

afterEach(() => {
  closeChatDb(chatDb);
  aliceDb.close();
  globalThis.fetch = originalFetch;
});

// ═══════════════════════════════════════════
// GET /chat/api/models
// ═══════════════════════════════════════════

describe('GET /chat/api/models', () => {
  it('should return model list for authenticated request', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaTagsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await app.handle(modelsRequestChat(auth.cookie));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models).toHaveLength(2);
    expect(body.models[0].name).toBe('llama3.1:8b');
    expect(body.models[1].name).toBe('qwen2.5:7b');
  });

  it('should return 401 without auth cookie', async () => {
    const res = await app.handle(new Request('http://localhost/chat/api/models'));

    expect(res.status).toBe(401);
  });

  it('should return 502 when Ollama connection fails', async () => {
    globalThis.fetch = mockFetchReject(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    );

    const res = await app.handle(modelsRequestChat(auth.cookie));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Upstream service error');
  });

  it('should return 504 when Ollama times out', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    globalThis.fetch = mockFetchReject(() => Promise.reject(timeoutError));

    const res = await app.handle(modelsRequestChat(auth.cookie));

    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toBe('Upstream request timed out');
  });
});

// ═══════════════════════════════════════════
// GET /chat/api/conversations — 会话列表
// ═══════════════════════════════════════════

describe('GET /chat/api/conversations', () => {
  it('should return empty list when no conversations exist', async () => {
    const res = await app.handle(conversationsRequest(auth.cookie));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toEqual([]);
  });

  it('should return conversations after chat creates them', async () => {
    // Mock Ollama 非流式响应
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    // 发送聊天消息（自动创建会话）
    await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello world' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );

    const res = await app.handle(conversationsRequest(auth.cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].title).toBe('Hello world');
    expect(body.conversations[0].model).toBe('llama3.1:8b');
  });
});

// ═══════════════════════════════════════════
// POST /chat/api/chat — 流式 SSE 聊天
// ═══════════════════════════════════════════

describe('POST /chat/api/chat (streaming SSE)', () => {
  it('should return SSE stream with proper headers', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: true,
      }, auth.cookie),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('should emit meta event with conversation_id first', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: true,
      }, auth.cookie),
    );

    const text = await res.text();
    expect(text).toContain('data: ');
    expect(text).toContain('"type":"meta"');
    expect(text).toContain('"conversation_id"');
  });

  it('should emit token events for each chunk', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: true,
      }, auth.cookie),
    );

    const text = await res.text();
    // 验证包含 token 事件
    expect(text).toContain('"type":"token"');
    expect(text).toContain('"content":"Hello"');
    // 验证包含 done 事件
    expect(text).toContain('"type":"done"');
  });

  it('should save user message and assistant message to database', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: true,
      }, auth.cookie),
    );

    // 消费流以触发数据库写入
    await res.text();

    // 检查会话列表
    const convRes = await app.handle(conversationsRequest(auth.cookie));
    const convBody = await convRes.json();
    expect(convBody.conversations).toHaveLength(1);
    const convId = convBody.conversations[0].id;

    // 检查消息
    const msgRes = await app.handle(messagesRequest(convId, auth.cookie));
    const msgBody = await msgRes.json();
    expect(msgBody.messages.length).toBeGreaterThanOrEqual(1);
    // 至少有一条 user 消息
    const userMsg = msgBody.messages.find(
      (m: { role: string }) => m.role === 'user',
    );
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toBe('Hello');
  });

  it('should append messages to existing conversation', async () => {
    // 第一次请求创建会话
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );
    const res1 = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'First message' }],
        model: 'llama3.1:8b',
        stream: true,
      }, auth.cookie),
    );
    const text1 = await res1.text();
    // 提取 meta 事件中的 conversation_id
    const metaMatch = text1.match(/"conversation_id":"([^"]+)"/);
    const convId = metaMatch?.[1];
    expect(convId).toBeDefined();

    // 第二次请求使用同一会话
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );

    const res2 = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Second message' }],
        model: 'llama3.1:8b',
        stream: true,
        conversation_id: convId,
      }, auth.cookie),
    );
    await res2.text();

    // 验证消息追加
    const msgRes = await app.handle(messagesRequest(convId!, auth.cookie));
    const msgBody = await msgRes.json();
    const userMessages = msgBody.messages.filter(
      (m: { role: string }) => m.role === 'user',
    );
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
  });

  it('should default to streaming when stream is not specified', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(createOllamaStreamResponse()),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
      }, auth.cookie),
    );

    // 默认应该是流式
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should return 404 when conversation_id does not exist', async () => {
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        conversation_id: '00000000-0000-0000-0000-000000000000',
      }, auth.cookie),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });
});

// ═══════════════════════════════════════════
// POST /chat/api/chat — 非流式聊天
// ═══════════════════════════════════════════

describe('POST /chat/api/chat (non-streaming)', () => {
  it('should return JSON with conversation_id and content', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversation_id).toBeDefined();
    expect(body.content).toBe('Hello! How can I help you today?');
  });

  it('should save both user and assistant messages', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );

    const body = await res.json();
    const convId = body.conversation_id;

    const msgRes = await app.handle(messagesRequest(convId, auth.cookie));
    const msgBody = await msgRes.json();
    expect(msgBody.messages.length).toBeGreaterThanOrEqual(2);
    expect(msgBody.messages[0].role).toBe('user');
    expect(msgBody.messages[0].content).toBe('Hello');
    expect(msgBody.messages[1].role).toBe('assistant');
    expect(msgBody.messages[1].content).toBe(
      'Hello! How can I help you today?',
    );
  });

  it('should return 500 when Ollama returns HTTP error', async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response('model not found', {
          status: 404,
          statusText: 'Not Found',
        }),
      ),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'unknown-model',
        stream: false,
      }, auth.cookie),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('should return 504 when Ollama times out', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    globalThis.fetch = mockFetchReject(() => Promise.reject(timeoutError));
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );

    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toBe('Upstream request timed out');
  });

  it('should return 502 when Ollama connection fails', async () => {
    globalThis.fetch = mockFetchReject(() =>
      Promise.reject(new Error('Connection refused')),
    );
    const res = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Upstream service error');
  });
});

// ═══════════════════════════════════════════
// GET /chat/api/conversations/:id/messages
// ═══════════════════════════════════════════

describe('GET /chat/api/conversations/:id/messages', () => {
  it('should return 404 for non-existent conversation', async () => {
    const res = await app.handle(
      messagesRequest('00000000-0000-0000-0000-000000000000', auth.cookie),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });

  it('should return messages for existing conversation', async () => {
    // 先创建一个聊天会话（非流式，便于验证）
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const chatRes = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Test message' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );
    const chatBody = await chatRes.json();
    const convId = chatBody.conversation_id;

    const res = await app.handle(messagesRequest(convId, auth.cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toBe('Test message');
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[1].content).toBe('Hello! How can I help you today?');
  });
});

// ═══════════════════════════════════════════
// PUT /chat/api/conversations/:id/title
// ═══════════════════════════════════════════

describe('PUT /chat/api/conversations/:id/title', () => {
  it('should return 404 for non-existent conversation', async () => {
    const res = await app.handle(
      renameRequest(
        '00000000-0000-0000-0000-000000000000',
        'New Title',
        auth.cookie,
      ),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });

  it('should update conversation title', async () => {
    // 创建会话
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const chatRes = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Original' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );
    const chatBody = await chatRes.json();
    const convId = chatBody.conversation_id;

    // 重命名
    const renameRes = await app.handle(
      renameRequest(convId, 'Renamed Title', auth.cookie),
    );
    expect(renameRes.status).toBe(200);
    const renameBody = await renameRes.json();
    expect(renameBody.conversation).toBeDefined();
    expect(renameBody.conversation.title).toBe('Renamed Title');

    // 验证列表中的标题已更新
    const listRes = await app.handle(conversationsRequest(auth.cookie));
    const listBody = await listRes.json();
    expect(listBody.conversations[0].title).toBe('Renamed Title');
  });
});

// ═══════════════════════════════════════════
// DELETE /chat/api/conversations/:id
// ═══════════════════════════════════════════

describe('DELETE /chat/api/conversations/:id', () => {
  it('should return 404 for non-existent conversation', async () => {
    const res = await app.handle(
      deleteRequest('00000000-0000-0000-0000-000000000000', auth.cookie),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });

  it('should delete conversation and return success', async () => {
    // 创建会话
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const chatRes = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'To be deleted' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );
    const chatBody = await chatRes.json();
    const convId = chatBody.conversation_id;

    // 确认会话存在
    const listRes1 = await app.handle(conversationsRequest(auth.cookie));
    const listBody1 = await listRes1.json();
    expect(listBody1.conversations).toHaveLength(1);

    // 删除
    const delRes = await app.handle(deleteRequest(convId, auth.cookie));
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    // 确认会话已删除
    const listRes2 = await app.handle(conversationsRequest(auth.cookie));
    const listBody2 = await listRes2.json();
    expect(listBody2.conversations).toHaveLength(0);

    // 验证级联删除消息（通过直接查询 DB）
    const row = chatDb
      .query('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?')
      .get(convId) as { count: number } | null;
    expect(row?.count).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 综合场景
// ═══════════════════════════════════════════

describe('Integration scenarios', () => {
  it('full CRUD flow: chat → list conversations → read messages → rename → delete', async () => {
    // 1. 发送聊天消息（非流式）
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(ollamaChatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const chatRes = await app.handle(
      chatRequestBody({
        messages: [{ role: 'user', content: 'Hello Alice' }],
        model: 'llama3.1:8b',
        stream: false,
      }, auth.cookie),
    );
    expect(chatRes.status).toBe(200);
    const chatBody = await chatRes.json();
    expect(chatBody.conversation_id).toBeDefined();
    const convId: string = chatBody.conversation_id;

    // 3. 获取会话列表
    const listRes = await app.handle(conversationsRequest(auth.cookie));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.conversations).toHaveLength(1);
    expect(listBody.conversations[0].title).toBe('Hello Alice');

    // 4. 读取消息
    const msgRes = await app.handle(messagesRequest(convId, auth.cookie));
    expect(msgRes.status).toBe(200);
    const msgBody = await msgRes.json();
    expect(msgBody.messages).toHaveLength(2);

    // 5. 重命名
    const renameRes = await app.handle(
      renameRequest(convId, 'My Chat', auth.cookie),
    );
    expect(renameRes.status).toBe(200);

    // 6. 删除
    const delRes = await app.handle(deleteRequest(convId, auth.cookie));
    expect(delRes.status).toBe(200);

    // 7. 验证已删除
    const finalListRes = await app.handle(conversationsRequest(auth.cookie));
    const finalListBody = await finalListRes.json();
    expect(finalListBody.conversations).toHaveLength(0);
  });
});