import { config } from '../config';
import type { OllamaChatRequest, OllamaTagsResponse, RunningModel } from '../types';

// 解析模型别名
function resolveModelAlias(model: string): string {
  return config.modelAliases?.[model] ?? model;
}

// Ollama 请求超时（30秒）
const OLLAMA_TIMEOUT = 30_000;

// Ollama 通信错误
export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

// 发送聊天请求到 Ollama
export async function chat(request: OllamaChatRequest): Promise<Response> {
  const actualModel = resolveModelAlias(request.model);
  const payload = { ...request, model: actualModel };

  let response: Response;
  try {
    response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT),
    });
  } catch (err) {
    if (err instanceof OllamaError) throw err;
    // 区分超时和连接错误
    const isTimeout = err instanceof Error && (
      err.name === 'TimeoutError' || err.message.includes('timed out')
    );
    throw new OllamaError(
      isTimeout
        ? 'Ollama request timed out'
        : `Ollama connection failed: ${err instanceof Error ? err.message : String(err)}`,
      isTimeout ? 504 : 502,
      isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new OllamaError(
      `Ollama error: ${response.status} ${response.statusText}`,
      response.status,
      response.statusText,
      body,
    );
  }

  return response;
}

// 获取模型列表
export async function listModels(): Promise<OllamaTagsResponse> {
  let response: Response;
  try {
    response = await fetch(`${config.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT),
    });
  } catch (err) {
    if (err instanceof OllamaError) throw err;
    // 区分超时和连接错误
    const isTimeout = err instanceof Error && (
      err.name === 'TimeoutError' || err.message.includes('timed out')
    );
    throw new OllamaError(
      isTimeout
        ? 'Ollama request timed out'
        : `Ollama connection failed: ${err instanceof Error ? err.message : String(err)}`,
      isTimeout ? 504 : 502,
      isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new OllamaError(
      `Ollama error: ${response.status} ${response.statusText}`,
      response.status,
      response.statusText,
      body,
    );
  }

  return response.json() as Promise<OllamaTagsResponse>;
}

// 健康检查：检测 Ollama 是否可达
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000), // 健康检查用较短超时
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 获取正在运行的模型列表
export async function listRunningModels(): Promise<RunningModel[]> {
  let response: Response;
  try {
    response = await fetch(`${config.ollamaUrl}/api/ps`, {
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT),
    });
  } catch {
    // 连接错误或超时，返回空数组
    return [];
  }

  if (!response.ok) {
    // Ollama 返回错误状态码（如 404），返回空数组
    return [];
  }

  const data = (await response.json()) as { models: RunningModel[] };
  return data.models ?? [];
}
