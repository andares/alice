/**
 * OpenAI-compatible variant handler
 *
 * 将 OpenAI 标准请求直接转发到上游 OpenAI-compatible API，
 * 不进行任何格式转换（流式 ReadableStream 直通，非流式 JSON 直通）。
 */

import type { RouterModel } from '../../foundation/types';
import type { ChatCompletionRequest } from '../../types';

/** 上游请求超时（30秒） */
const ROUTER_TIMEOUT = 30_000;

/**
 * 构造 OpenAI 标准错误响应
 */
function errorResponse(
  status: number,
  message: string,
  type: string,
  code: string,
): Response {
  return new Response(
    JSON.stringify({
      error: { message, type, param: null, code },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

/**
 * 将 OpenAI 标准请求转发到上游 OpenAI-compatible API
 *
 * - 非流式：上游 JSON 响应直通
 * - 流式：上游 ReadableStream（SSE）直通，不转换格式
 * - 上游返回非 2xx：返回 OpenAI 标准错误格式
 *
 * @param config  Router 模型配置（含上游 URL、密钥、模型名）
 * @param request OpenAI 标准 Chat Completion 请求
 * @returns 上游原始 Response（流式/非流式均直通）或 OpenAI 错误 Response
 */
export async function openaiChatCompletion(
  config: RouterModel,
  request: ChatCompletionRequest,
): Promise<Response> {
  const url = `${config.base_url}/chat/completions`;

  // 构造上游请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.api_key) {
    headers['Authorization'] = `Bearer ${config.api_key}`;
  }

  // 构造上游请求体：model 使用配置中的上游模型名
  const payload = { ...request, model: config.model };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ROUTER_TIMEOUT),
    });
  } catch (err) {
    // 网络错误 / 超时
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.message.includes('timed out'));
    if (isTimeout) {
      return errorResponse(
        504,
        'Upstream request timed out',
        'upstream_timeout',
        'timeout',
      );
    }
    return errorResponse(
      502,
      `Upstream connection failed: ${err instanceof Error ? err.message : String(err)}`,
      'upstream_error',
      'upstream_failure',
    );
  }

  if (!response.ok) {
    // 尝试从上游错误响应体中提取错误消息
    const body = await response.text().catch(() => '');
    let message = `Upstream error: ${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // 非 JSON 响应体，保持默认消息
    }
    return errorResponse(
      response.status,
      message,
      'upstream_error',
      'upstream_failure',
    );
  }

  // 成功响应直通（流式 ReadableStream / 非流式 JSON）
  return response;
}
