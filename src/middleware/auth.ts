import { Elysia } from 'elysia';
import type { OptionalHandler } from 'elysia';
import { bearer } from '@elysiajs/bearer';
import type { Database } from 'bun:sqlite';
import { validateApiKey } from '../foundation/api-keys';
import type { OpenAIErrorResponse } from '../types';

type AuthBeforeHandleContext = Parameters<
  OptionalHandler<
    {},
    {
      decorator: {};
      store: {};
      derive: {
        isAuthenticated: boolean;
      };
      resolve: {};
    }
  >
>[0];

/**
 * 构造 OpenAI 标准格式的 401 错误响应
 *
 * 格式对齐 OpenAI API 规范：
 * { error: { message, type: "invalid_request_error", code: "invalid_api_key" } }
 */
export function unauthorizedError(message: string, code: string): OpenAIErrorResponse {
  return {
    error: {
      message,
      type: 'invalid_request_error',
      param: null,
      code,
    },
  };
}

/**
 * 认证插件 —— 多 Key + bcrypt 验证版
 *
 * 使用 @elysiajs/bearer 提取 Bearer Token，然后在 derive 中
 * 异步调用 validateApiKey 逐条 bcrypt 比对 api_keys 表中的活跃密钥。
 *
 * 同时注册 macro `requireAuth`，路由可通过 guard 启用认证检查。
 *
 * @param db 包含 api_keys 表的数据库实例
 */
export function authPlugin(db: Database) {
  return new Elysia({ name: 'auth' })
    .use(bearer())
    .derive({ as: 'scoped' }, async ({ bearer }) => {
      if (!bearer) {
        return { isAuthenticated: false };
      }
      const valid = await validateApiKey(db, bearer);
      return { isAuthenticated: valid };
    })
    .macro(({ onBeforeHandle }) => ({
      /**
       * 路由级认证开关
       *
       * 在路由 guard 中传入 `requireAuth: true` 即可启用。
       * 未提供或提供无效 Bearer Token 时返回 401 及 OpenAI 标准错误格式。
       */
      requireAuth(enabled: boolean) {
        if (!enabled) return;

        onBeforeHandle((context: AuthBeforeHandleContext) => {
          const { isAuthenticated, set } = context;
          if (!isAuthenticated) {
            set.status = 401;
            set.headers['WWW-Authenticate'] = 'Bearer realm="api"';
            return unauthorizedError('Invalid API Key', 'invalid_api_key');
          }
        });
      },
    }));
}
