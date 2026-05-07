import { Elysia, t } from 'elysia';
import { bearer } from '@elysiajs/bearer';
import { unauthorizedError } from '../middleware/auth';
import { chat, listModels, OllamaError } from '../services/ollama';
import {
  transformRequest,
  transformResponse,
  transformStream,
  transformError,
  transformModelList,
} from '../transformers/openai';
import { getDefaultLogger } from '../utils/logger';
import { config } from '../config';
import type { ChatCompletionRequest } from '../types';

/**
 * v1 API 路由组
 *
 * 包含 OpenAI 兼容接口：
 * - POST /v1/chat/completions
 * - GET /v1/models
 *
 * 所有路由均启用认证守卫，并附带唯一 requestId。
 */
export const v1Routes = new Elysia({ prefix: '/v1' })
  .use(bearer())
  .guard({
    beforeHandle: ({ bearer: token, set }) => {
      if (!token || token !== config.apiKey) {
        set.status = 401;
        set.headers['WWW-Authenticate'] = 'Bearer realm="api"';
        return unauthorizedError('Invalid API Key', 'invalid_api_key');
      }
    },
  }, (app) =>
    app
      // POST /v1/chat/completions
      .post(
        '/chat/completions',
        async ({ body, set }) => {
          const logger = getDefaultLogger();
          const requestId = crypto.randomUUID();
          const startTime = performance.now();
          const req = body as ChatCompletionRequest;

          if (!logger) {
            set.status = 500;
            return transformError(
              'Internal server error',
              'internal_error',
              'internal_error',
            );
          }

          try {
            // 转换请求格式
            const ollamaReq = transformRequest(req);

            // 调用 Ollama
            const ollamaResp = await chat(ollamaReq);

            if (req.stream) {
              // 流式响应：转换 NDJSON → SSE
              const sseStream = transformStream(ollamaResp.body!, req.model);
              logger.info('Chat completion (stream)', {
                requestId,
                model: req.model,
                duration: Math.round(performance.now() - startTime),
              });
              return new Response(sseStream, {
                headers: {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  Connection: 'keep-alive',
                },
              });
            }

            // 非流式响应
            const ollamaJson = await ollamaResp.json();
            const openaiResp = transformResponse(ollamaJson, req.model);
            logger.info('Chat completion', {
              requestId,
              model: req.model,
              duration: Math.round(performance.now() - startTime),
            });
            return openaiResp;
          } catch (err) {
            if (err instanceof OllamaError) {
              // 504 超时、502 上游错误，其他状态码映射为 500
              if (err.status === 504) {
                set.status = 504;
                logger.error('Ollama upstream timeout', {
                  requestId,
                  error: String(err),
                });
                return transformError(
                  'Upstream request timed out',
                  'upstream_timeout',
                  'timeout',
                );
              }
              if (err.status === 502) {
                set.status = 502;
                logger.error('Ollama upstream error', {
                  requestId,
                  error: String(err),
                });
                return transformError(
                  'Upstream service error',
                  'upstream_error',
                  'upstream_failure',
                );
              }
              // 其他 OllamaError（如 Ollama 返回 4xx/5xx）
              set.status = 500;
              logger.error('Ollama error', {
                requestId,
                error: String(err),
                ollamaStatus: err.status,
              });
              return transformError(
                'Internal server error',
                'internal_error',
                'internal_error',
              );
            }

            // 未知错误
            set.status = 500;
            logger.error('Unexpected error', {
              requestId,
              error: String(err),
            });
            return transformError(
              'Internal server error',
              'internal_error',
              'internal_error',
            );
          }
        },
        {
          body: t.Object({
            model: t.String(),
            messages: t.Array(
              t.Object({
                role: t.String(),
                content: t.String(),
              }),
            ),
            temperature: t.Optional(t.Number()),
            max_tokens: t.Optional(t.Number()),
            stream: t.Optional(t.Boolean()),
            top_p: t.Optional(t.Number()),
            n: t.Optional(t.Number()),
            stop: t.Optional(t.Union([t.String(), t.Array(t.String())])),
            frequency_penalty: t.Optional(t.Number()),
            presence_penalty: t.Optional(t.Number()),
          }),
        },
      )

      // GET /v1/models
      .get('/models', async ({ set }) => {
        const logger = getDefaultLogger();
        const requestId = crypto.randomUUID();

        if (!logger) {
          set.status = 500;
          return transformError(
            'Internal server error',
            'internal_error',
            'internal_error',
          );
        }

        try {
          const tags = await listModels();
          logger.info('List models', { requestId });
          return transformModelList(tags);
        } catch (err) {
          if (err instanceof OllamaError) {
            set.status = err.status === 504 ? 504 : 502;
            logger.error('Ollama upstream error (models)', {
              requestId,
              error: String(err),
            });
            return transformError(
              err.status === 504 ? 'Upstream request timed out' : 'Upstream service error',
              err.status === 504 ? 'upstream_timeout' : 'upstream_error',
              err.status === 504 ? 'timeout' : 'upstream_failure',
            );
          }

          set.status = 500;
          logger.error('Unexpected error (models)', {
            requestId,
            error: String(err),
          });
          return transformError(
            'Internal server error',
            'internal_error',
            'internal_error',
          );
        }
      }),
  );
