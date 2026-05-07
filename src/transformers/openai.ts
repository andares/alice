import type {
  ChatCompletionRequest,
  OllamaChatRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  OllamaChatResponse,
  OllamaStreamChunk,
  OpenAIErrorResponse,
  OllamaTagsResponse,
  ModelListResponse,
} from '../types';
import { config } from '../config';

// 解析模型别名
function resolveModelAlias(model: string): string {
  return config.modelAliases?.[model] ?? model;
}

// 将 OpenAI 请求转换为 Ollama 请求
export function transformRequest(req: ChatCompletionRequest): OllamaChatRequest {
  return {
    model: resolveModelAlias(req.model),
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: req.stream ?? false,
    options: {
      temperature: req.temperature,
      num_predict: req.max_tokens,
    },
  };
}

// 将 Ollama 响应转换为 OpenAI 非流式响应
export function transformResponse(
  ollamaResp: OllamaChatResponse,
  model: string,
): ChatCompletionResponse {
  const content = ollamaResp.message?.content ?? '';
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: ollamaResp.prompt_eval_count ?? 0,
      completion_tokens: ollamaResp.eval_count ?? 0,
      total_tokens: (ollamaResp.prompt_eval_count ?? 0) + (ollamaResp.eval_count ?? 0),
    },
  };
}

// 将 Ollama NDJSON 流转换为 OpenAI SSE 流
export function transformStream(
  ollamaBody: ReadableStream<Uint8Array>,
  model: string,
): ReadableStream<Uint8Array> {
  const reader = ollamaBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      // 循环读取直到产生输出或流结束
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let hasOutput = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const chunk: OllamaStreamChunk = JSON.parse(trimmed);

            if (chunk.done) {
              const finalChunk: ChatCompletionChunk = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: 'stop',
                  },
                ],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }

            const content = chunk.message?.content ?? '';
            if (content) {
              const sseChunk: ChatCompletionChunk = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: { content },
                    finish_reason: null,
                  },
                ],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
              hasOutput = true;
            }
          } catch {
            // 忽略无法解析的行
          }
        }

        if (hasOutput) return;
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// 将上游错误转换为 OpenAI 标准错误格式
export function transformError(
  message: string,
  type: string,
  code: string,
  param: string | null = null,
): OpenAIErrorResponse {
  return {
    error: {
      message,
      type,
      param,
      code,
    },
  };
}

// 将 Ollama 模型列表转换为 OpenAI 格式
export function transformModelList(tags: OllamaTagsResponse): ModelListResponse {
  return {
    object: 'list',
    data: (tags.models ?? []).map((m) => ({
      id: m.name,
      object: 'model' as const,
      created: Math.floor(new Date(m.modified_at).getTime() / 1000),
      owned_by: 'ollama',
    })),
  };
}
