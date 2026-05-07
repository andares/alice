import { Elysia } from 'elysia';
import type { OptionalHandler } from 'elysia';
import { bearer } from '@elysiajs/bearer';
import { config } from '../config';
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
 */
export function unauthorizedError(message: string, code: string): OpenAIErrorResponse {
  return {
    error: {
      message,
      type: 'authentication_error',
      param: null,
      code,
    },
  };
}

/**
 * 认证插件
 *
 * 使用 @elysiajs/bearer 提取 Bearer Token，并在 derive 中校验是否与 config.apiKey 匹配。
 * 同时注册一个 macro `requireAuth`，路由可通过 guard 启用认证检查。
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .use(bearer())
  .derive(({ bearer }) => ({
    isAuthenticated: !!bearer && bearer === config.apiKey,
  }))
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
