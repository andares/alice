import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { authPlugin, unauthorizedError } from '../middleware/auth';
import { listModels, OllamaError } from '../services/ollama';
import { transformError } from '../transformers/openai';
import { getDefaultLogger } from '../utils/logger';
import { routeToProvider } from '../services/router';
import { listRouterModels } from '../foundation/router-models';
import type { ChatCompletionRequest } from '../types';

export function createV1Routes(db: Database) {
  return new Elysia({ prefix: '/v1' })
    .use(authPlugin(db))
    .guard({
      beforeHandle: (context) => {
        if (!(context as unknown as { isAuthenticated: boolean }).isAuthenticated) {
          const { set } = context;
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
            const response = await routeToProvider(db, req.model, req);

            // routeToProvider 返回的 Response 已经是最终格式
            // 需要记录日志
            logger.info('Chat completion', {
              requestId,
              model: req.model,
              duration: Math.round(performance.now() - startTime),
            });

            return response;
          } catch (err) {
            // routeToProvider 内部已处理所有错误并返回 Response，
            // 此处仅捕获意外异常
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
          // 从 router_models 获取已配置的模型
          const routerModels = listRouterModels(db);
          const routerModelList = routerModels
            .filter((m) => m.name !== '__default__')
            .map((m) => ({
              id: m.name,
              object: 'model' as const,
              created: m.created_at,
              owned_by: 'alice-router',
            }));

          // 从 Ollama 获取原生模型列表
          let ollamaModelList: Array<{ id: string; object: 'model'; created: number; owned_by: string }> = [];
          try {
            const tags = await listModels();
            ollamaModelList = (tags.models ?? []).map((m) => ({
              id: m.name,
              object: 'model' as const,
              created: Math.floor(new Date(m.modified_at).getTime() / 1000),
              owned_by: 'ollama',
            }));
          } catch {
            // Ollama 不可达时仍返回 router_models
            logger.warn('Ollama unreachable, returning router models only', { requestId });
          }

          // 合并去重（router_models 优先）
          const routerIds = new Set(routerModelList.map((m) => m.id));
          const merged = [...routerModelList, ...ollamaModelList.filter((m) => !routerIds.has(m.id))];

          logger.info('List models', { requestId });
          return { object: 'list', data: merged };
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
}