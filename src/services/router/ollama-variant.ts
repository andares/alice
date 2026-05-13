/**
 * Ollama variant handler
 *
 * 将 OpenAI 标准请求转换为 Ollama 格式，调用 Ollama /api/chat，
 * 再将响应转换回 OpenAI 格式返回。
 *
 * 这是 __default__ 路由使用的 variant，保持与原有 v1 路由的兼容性。
 */

import type { RouterModel } from '../../foundation/types';
import type { ChatCompletionRequest, OllamaChatRequest } from '../../types';
import { transformStream, transformResponse, transformError } from '../../transformers/openai';

/** Ollama 请求超时（30秒） */
const OLLAMA_TIMEOUT = 30_000;

/**
 * 将 OpenAI 请求转换为 Ollama 请求格式
 */
function transformRequest(req: ChatCompletionRequest): OllamaChatRequest {
  return {
    model: req.model,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: req.stream ?? false,
    options: {
      temperature: req.temperature,
      num_predict: req.max_tokens,
    },
  };
}

/**
 * Ollama variant handler
 *
 * 流程：
 * 1. 将 OpenAI 请求转换为 Ollama 格式
 * 2. 调用 Ollama /api/chat
 * 3. 将 Ollama 响应转换回 OpenAI 格式
 *
 * @param config  Router 模型配置（base_url 为 Ollama 地址，model 为空时使用请求中的 model）
 * @param request OpenAI 标准 Chat Completion 请求
 * @returns OpenAI 格式的 Response（流式 SSE 或非流式 JSON）
 */
export async function ollamaChatCompletion(
  config: RouterModel,
  request: ChatCompletionRequest,
): Promise<Response> {
  const ollamaUrl = config.base_url;
  // __default__ 的 model 字段为空，使用请求中的原始 model
  const modelName = config.model || request.model;
  const ollamaReq = transformRequest({ ...request, model: modelName });

  let response: Response;
  try {
    response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaReq),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.message.includes('timed out'));

    if (isTimeout) {
      return new Response(
        JSON.stringify(transformError('Upstream request timed out', 'upstream_timeout', 'timeout')),
        { status: 504, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify(transformError(
        `Upstream connection failed: ${err instanceof Error ? err.message : String(err)}`,
        'upstream_error',
        'upstream_failure',
      )),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!response.ok) {
    return new Response(
      JSON.stringify(transformError(
        `Ollama error: ${response.status} ${response.statusText}`,
        'upstream_error',
        'upstream_failure',
      )),
      { status: response.status >= 500 ? 502 : response.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 流式响应：转换 NDJSON → SSE
  if (request.stream) {
    const sseStream = transformStream(response.body!, modelName);
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // 非流式响应：转换 Ollama JSON → OpenAI JSON
  const ollamaJson = await response.json();
  const openaiResp = transformResponse(ollamaJson, modelName);
  return Response.json(openaiResp);
}