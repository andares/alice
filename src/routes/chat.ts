import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import type { Database } from 'bun:sqlite';
import { listModels, OllamaError } from '../services/ollama';
import { config } from '../config';
import {
  createConversation,
  getConversations,
  getConversation,
  updateConversationTitle,
  deleteConversation,
  createMessage,
  getMessages,
} from '../services/chat-db';
import { getDefaultLogger } from '../utils/logger';
import { elysiaAuthPlugin } from '../foundation/elysia-auth';
import {
  createAssistor,
  getAssistor,
  listAssistors,
  updateAssistor,
  deleteAssistor,
} from '../foundation/assistors';
import { isAdmin } from '../foundation/administrators';
import type { User } from '../foundation/types';
import type { OllamaStreamChunk } from '../types';

type AuthContext = {
  currentUser: User | null;
  set: { status: number | string };
  params: Record<string, string>;
  body: unknown;
};

/**
 * 聊天 API 路由组
 *
 * 所有端点需要 JWT 认证（requireUser guard）
 */
export const chatRoutes = (chatDb: Database, aliceDb: Database) =>
  new Elysia({ prefix: '/chat/api' })
    .use(cookie())
    .use(elysiaAuthPlugin(aliceDb))

    // ── POST /chat — 聊天补全（流式 SSE / 非流式 JSON） ──
    .post('/chat', async (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const logger = getDefaultLogger();
      const body = ctx.body as {
        messages: Array<{ role: string; content: string }>;
        model: string;
        stream?: boolean;
        conversation_id?: string;
      };

      const messages = body.messages;
      const model = body.model;
      const stream = body.stream ?? true; // 默认流式
      const conversationId = body.conversation_id;

      // 验证 conversation_id（如果提供）
      let convId = conversationId ?? null;
      if (convId) {
        const conv = getConversation(chatDb, convId, userId);
        if (!conv) {
          set.status = 404;
          return { error: 'Conversation not found' };
        }
      }

      // 创建或获取会话
      if (!convId) {
        const title = messages[0]?.content?.slice(0, 50) ?? 'New Chat';
        const conv = createConversation(chatDb, { title, model }, userId);
        convId = conv.id;
      }

      // 保存用户消息
      const userMessage = messages[messages.length - 1];
      createMessage(chatDb, {
        conversation_id: convId,
        role: userMessage.role as 'user' | 'assistant' | 'system',
        content: userMessage.content,
      }, userId);

      // 构造 Ollama 请求
      const ollamaRequest = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream,
      };

      try {
        const response = await fetch(`${config.ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaRequest),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          set.status = 500;
          logger?.error('Ollama chat error', { status: response.status });
          return { error: 'Internal server error' };
        }

        if (stream) {
          // 流式 SSE 响应
          const encoder = new TextEncoder();
          const streamId = convId;
          const ollamaBody = response.body!;

          const sseStream = new ReadableStream({
            async start(controller) {
              // 发送 meta 事件
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'meta', conversation_id: streamId })}\n\n`));

              const reader = ollamaBody.getReader();
              const decoder = new TextDecoder();
              let fullContent = '';

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const text = decoder.decode(value, { stream: true });
                  const lines = text.split('\n').filter((l: string) => l.trim());

                  for (const line of lines) {
                    try {
                      const chunk: OllamaStreamChunk = JSON.parse(line);
                      if (chunk.message?.content) {
                        fullContent += chunk.message.content;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: chunk.message.content })}\n\n`));
                      }
                      if (chunk.done) {
                        // 保存助手消息
                        createMessage(chatDb, {
                          conversation_id: convId!,
                          role: 'assistant',
                          content: fullContent || '',
                        }, userId);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversation_id: streamId })}\n\n`));
                      }
                    } catch {
                      // 忽略解析错误
                    }
                  }
                }
              } catch (err) {
                logger?.error('Stream error', { error: String(err) });
              } finally {
                controller.close();
              }
            },
          });

          return new Response(sseStream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        } else {
          // 非流式 JSON 响应
          const ollamaJson = await response.json() as { message?: { content: string }; done: boolean };
          const content = ollamaJson.message?.content ?? '';

          // 保存助手消息
          createMessage(chatDb, {
            conversation_id: convId!,
            role: 'assistant',
            content,
          }, userId);

          return { conversation_id: convId, content };
        }
      } catch (err) {
        const isTimeout = err instanceof Error && (
          err.name === 'TimeoutError' || err.message.includes('timed out')
        );
        if (isTimeout) {
          set.status = 504;
          return { error: 'Upstream request timed out' };
        }
        set.status = 502;
        logger?.error('Ollama connection error', { error: String(err) });
        return { error: 'Upstream service error' };
      }
    }, {
      requireUser: true,
      body: t.Object({
        messages: t.Array(t.Object({
          role: t.String(),
          content: t.String(),
        })),
        model: t.String(),
        stream: t.Optional(t.Boolean()),
        conversation_id: t.Optional(t.String()),
      }),
    })

    .get('/models', async (ctx) => {
      const logger = getDefaultLogger();
      try {
        const tags = await listModels();
        logger?.info('Chat list models');
        return { models: tags.models };
      } catch (err) {
        const { set } = ctx as unknown as AuthContext;
        if (err instanceof OllamaError) {
          set.status = err.status === 504 ? 504 : 502;
          logger?.error('Ollama upstream error (models)', {
            error: String(err),
          });
          return {
            error:
              err.status === 504
                ? 'Upstream request timed out'
                : 'Upstream service error',
          };
        }
        set.status = 500;
        logger?.error('Unexpected error (models)', {
          error: String(err),
        });
        return { error: 'Internal server error' };
      }
    }, { requireUser: true })

    .get('/conversations', (ctx) => {
      const { currentUser } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const conversations = getConversations(chatDb, userId);
      return { conversations };
    }, { requireUser: true })

    .post('/conversations', (ctx) => {
      const { currentUser, body } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { title, model } = body as { title?: string; model?: string };
      const conv = createConversation(chatDb, { title, model }, userId);
      return { conversation: conv };
    }, {
      requireUser: true,
      body: t.Object({
        title: t.Optional(t.String()),
        model: t.Optional(t.String()),
      }),
    })

    .get('/conversations/:id/messages', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { id } = ctx.params as { id: string };
      const conv = getConversation(chatDb, id, userId);
      if (!conv) {
        set.status = 404;
        return { error: 'Conversation not found' };
      }
      const messages = getMessages(chatDb, id, userId);
      return { messages };
    }, { requireUser: true })

    .post('/conversations/:id/messages', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { id } = ctx.params as { id: string };
      const conv = getConversation(chatDb, id, userId);
      if (!conv) {
        set.status = 404;
        return { error: 'Conversation not found' };
      }
      const { role, content, reasoning } = ctx.body as {
        role: 'user' | 'assistant' | 'system';
        content: string;
        reasoning?: string;
      };
      const message = createMessage(chatDb, {
        conversation_id: id,
        role,
        content,
        reasoning,
      }, userId);
      return { message };
    }, {
      requireUser: true,
      body: t.Object({
        role: t.Union([t.Literal('user'), t.Literal('assistant'), t.Literal('system')]),
        content: t.String(),
        reasoning: t.Optional(t.String()),
      }),
    })

    .delete('/conversations/:id', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { id } = ctx.params as { id: string };
      const conv = getConversation(chatDb, id, userId);
      if (!conv) {
        set.status = 404;
        return { error: 'Conversation not found' };
      }
      const deleted = deleteConversation(chatDb, id);
      if (!deleted) {
        set.status = 404;
        return { error: 'Conversation not found' };
      }
      return { success: true };
    }, { requireUser: true })

    .put('/conversations/:id/title', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { id } = ctx.params as { id: string };
      const { title } = ctx.body as { title: string };
      const conv = getConversation(chatDb, id, userId);
      if (!conv) {
        set.status = 404;
        return { error: 'Conversation not found' };
      }
      const updated = updateConversationTitle(chatDb, id, title);
      if (!updated) {
        set.status = 404;
        return { error: 'Conversation not found' };
      }
      return { conversation: updated };
    }, {
      requireUser: true,
      body: t.Object({
        title: t.String(),
      }),
    })

    // ===== Assistor CRUD =====

    .get('/assistors', (ctx) => {
      const { currentUser } = ctx as unknown as AuthContext;
      const user = currentUser as User;

      let assistors;
      if (isAdmin(aliceDb, user.id)) {
        assistors = listAssistors(aliceDb);
      } else {
        assistors = listAssistors(aliceDb, user.id);
      }

      return { assistors };
    }, { requireUser: true })

    .post('/assistors', (ctx) => {
      const { currentUser } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { name, model, system_prompt } = ctx.body as {
        name: string;
        model: string;
        system_prompt?: string;
      };
      const assistor = createAssistor(aliceDb, userId, {
        name,
        model,
        system_prompt: system_prompt ?? '',
      });
      return { assistor };
    }, {
      requireUser: true,
      body: t.Object({
        name: t.String(),
        model: t.String(),
        system_prompt: t.Optional(t.String()),
      }),
    })

    .put('/assistors/:id', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { id } = ctx.params as { id: string };
      const { name, model, system_prompt } = ctx.body as {
        name?: string;
        model?: string;
        system_prompt?: string;
      };
      const assistorId = Number(id);
      if (isNaN(assistorId)) {
        set.status = 400;
        return { error: 'Invalid assistor ID' };
      }
      const updated = updateAssistor(aliceDb, assistorId, userId, {
        name,
        model,
        system_prompt,
      });
      if (!updated) {
        const existing = getAssistor(aliceDb, assistorId);
        if (!existing) {
          set.status = 404;
          return { error: 'Assistor not found' };
        }
        set.status = 403;
        return { error: 'Forbidden' };
      }
      return { assistor: updated };
    }, {
      requireUser: true,
      body: t.Object({
        name: t.Optional(t.String()),
        model: t.Optional(t.String()),
        system_prompt: t.Optional(t.String()),
      }),
    })

    .delete('/assistors/:id', (ctx) => {
      const { currentUser, set } = ctx as unknown as AuthContext;
      const userId = (currentUser as User).id;
      const { id } = ctx.params as { id: string };
      const assistorId = Number(id);
      if (isNaN(assistorId)) {
        set.status = 400;
        return { error: 'Invalid assistor ID' };
      }
      const deleted = deleteAssistor(aliceDb, assistorId, userId);
      if (!deleted) {
        const existing = getAssistor(aliceDb, assistorId);
        if (!existing) {
          set.status = 404;
          return { error: 'Assistor not found' };
        }
        set.status = 403;
        return { error: 'Forbidden' };
      }
      return { success: true };
    }, { requireUser: true });