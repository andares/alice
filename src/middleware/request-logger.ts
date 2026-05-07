import type { Database } from 'bun:sqlite';
import { insertLog, truncateBody } from '../services/logger-db';
import type { LogEntry } from '../services/logger-db';

/**
 * 将 Elysia 生命周期中的请求/响应值序列化为可持久化文本
 */
function serializeBodyForLog(payload: unknown): string | null {
  if (payload == null || payload instanceof Response) return null;

  if (typeof payload === 'string') {
    return truncateBody(payload);
  }

  try {
    const serialized = JSON.stringify(payload);
    return serialized == null ? null : truncateBody(serialized);
  } catch {
    return null;
  }
}

/**
 * 记录 /v1/* 请求到 SQLite
 * 直接在全局 onAfterHandle 中调用，不依赖插件作用域
 * 注意：Elysia onAfterHandle 的 body 是请求体，response 是响应体
 */
export function logSuccessfulRequest(
  db: Database,
  request: Request,
  statusCode: number,
  duration: number,
  requestBody: unknown,
  responseBody?: unknown,
): void {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/v1/')) return;

  const log: LogEntry = {
    timestamp: Date.now(),
    method: request.method,
    path: url.pathname,
    request_body: serializeBodyForLog(requestBody),
    response_body: serializeBodyForLog(responseBody),
    user_id: '0',
    key_id: '0',
    duration_ms: Math.round(duration),
    status_code: statusCode,
  };

  insertLog(db, log);
}

/**
 * 记录 /v1/* 失败请求到 SQLite
 * 直接在全局 onError 中调用，不依赖插件作用域
 */
export function logFailedRequest(
  db: Database,
  request: Request,
  statusCode: number,
  duration: number,
  requestBody?: unknown,
  responseBody?: unknown,
): void {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/v1/')) return;

  const log: LogEntry = {
    timestamp: Date.now(),
    method: request.method,
    path: url.pathname,
    request_body: serializeBodyForLog(requestBody),
    response_body: serializeBodyForLog(responseBody),
    user_id: '0',
    key_id: '0',
    duration_ms: Math.round(duration),
    status_code: statusCode,
  };

  insertLog(db, log);
}