/**
 * Router 路由端点
 *
 * 提供 /router/<model>/chat/completions 端点，
 * 根据 URL 中的 model 参数查找 router_models 配置，
 * 将请求分发到对应的上游 Provider。
 */

import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { authPlugin } from '../middleware/auth';
import { routeToProvider } from '../services/router';
import { sanitizeModelParam, validateModelName, createRouterError } from '../services/router/validation';
import { getDefaultLogger } from '../utils/logger';
import type { ChatCompletionRequest } from '../types';

/**
 * 创建 Router 路由组
 *
 * 端点：POST /router/:model/chat/completions
 * - 使用 authPlugin(db) 的 requireAuth macro 做认证
 * - sanitizeModelParam 清理 URL 参数
 * - validateModelName 验证模型名合法性
 * - routeToProvider 执行转发
 * - 支持流式（stream: true → SSE）和非流式
 */
export function routerRoutes(db: Database) {
  return new Elysia({ prefix: '/router' })
    .use(authPlugin(db))
    .guard({
      requireAuth: true,
    }, (app) =>
      app.post(
        '/:model/chat/completions',
        async ({ params, body, set }) => {
          const logger = getDefaultLogger();
          const requestId = crypto.randomUUID();
          const startTime = performance.now();

          let modelName: string;
          try {
            modelName = sanitizeModelParam(params.model);
          } catch (err) {
            set.status = 400;
            return createRouterError(
              400,
              err instanceof Error ? err.message : 'Invalid model parameter',
              'invalid_request_error',
              'invalid_model_param',
            );
          }

          try {
            validateModelName(modelName);
          } catch (err) {
            set.status = 400;
            return createRouterError(
              400,
              err instanceof Error ? err.message : 'Invalid model name',
              'invalid_request_error',
              'invalid_model',
            );
          }

          const req = body as ChatCompletionRequest;
          const routedRequest: ChatCompletionRequest = {
            ...req,
            model: modelName,
          };

          try {
            const response = await routeToProvider(db, modelName, routedRequest);

            logger?.info('Router chat completion', {
              requestId,
              model: modelName,
              stream: routedRequest.stream ?? false,
              duration: Math.round(performance.now() - startTime),
            });

            return response;
          } catch (err) {
            set.status = 500;
            logger?.error('Router unexpected error', {
              requestId,
              model: modelName,
              error: String(err),
            });
            return createRouterError(
              500,
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
          params: t.Object({
            model: t.String(),
          }),
        },
      ),
    );
}