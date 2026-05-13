/**
 * Router 调度器
 *
 * 根据请求中的 model name 查找 router_models 配置，
 * 将请求分发到对应的 variant handler 处理。
 */

import type { Database } from 'bun:sqlite';
import { getRouterModelByName } from '../../foundation/router-models';
import type { RouterModel } from '../../foundation/types';
import type { ChatCompletionRequest } from '../../types';
import { openaiChatCompletion } from './openai-compatible';
import { ollamaChatCompletion } from './ollama-variant';

/** Variant handler 统一签名 */
type VariantHandler = (
  config: RouterModel,
  request: ChatCompletionRequest,
) => Promise<Response>;

/** Variant 注册表 */
const variantRegistry: Record<string, VariantHandler> = {
  openai: openaiChatCompletion,
  ollama: ollamaChatCompletion,
};

/**
 * 将 Chat Completion 请求路由到对应上游 Provider
 *
 * 流程：
 * 1. 根据 modelName 查找 router_models 配置
 * 2. 根据配置中的 variant 选择 handler
 * 3. 委托 handler 处理请求，返回 Response
 *
 * @param db        数据库实例
 * @param modelName 请求中的模型名（对外暴露的名称）
 * @param request   OpenAI 标准 Chat Completion 请求
 * @returns 上游原始 Response 或错误 Response
 */
export function routeToProvider(
  db: Database,
  modelName: string,
  request: ChatCompletionRequest,
): Promise<Response> {
  let model = getRouterModelByName(db, modelName);

  // 找不到指定 model 时 fallback 到 __default__（Ollama 直连）
  if (!model) {
    model = getRouterModelByName(db, '__default__');
  }

  if (!model) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            message: `Model '${modelName}' not found`,
            type: 'invalid_request_error',
            param: 'model',
            code: 'model_not_found',
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
  }

  const handler = variantRegistry[model.variant];
  if (!handler) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            message: `Unsupported variant: ${model.variant}`,
            type: 'invalid_request_error',
            param: null,
            code: 'unsupported_variant',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
  }

  return handler(model, request);
}
