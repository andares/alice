/**
 * Router 验证与错误处理工具
 *
 * 提供：
 * - sanitizeModelParam：URL 参数清理（解码、防注入、空值检测）
 * - createRouterError：生成 OpenAI 兼容的错误 Response
 * - validateModelName：复用 foundation 层的模型名校验
 */

import { validateModelName } from '../../foundation/router-models';
import type { OpenAIErrorResponse } from '../../types';

/**
 * 清理并验证 URL 路径中的模型名称参数
 *
 * 处理：
 * - URL 编码解码（encodeURIComponent → decodeURIComponent）
 * - 前后空白裁剪
 * - 空值检测（抛出 400 级别错误）
 * - 控制字符/空字节注入防护
 * - 路径遍历防护（../ 等）
 *
 * @param param 原始 URL 参数值
 * @returns 清理后的模型名
 * @throws 参数为空或包含非法字符时抛出 Error
 */
export function sanitizeModelParam(param: string): string {
  // 1. URL 解码
  let cleaned: string;
  try {
    cleaned = decodeURIComponent(param);
  } catch {
    throw new Error('模型参数包含无效的 URL 编码');
  }

  // 2. 去除前后空白
  cleaned = cleaned.trim();

  // 3. 空值检测
  if (cleaned.length === 0) {
    throw new Error('模型参数不能为空');
  }

  // 4. 控制字符 / 空字节注入防护
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(cleaned)) {
    throw new Error('模型参数包含非法控制字符');
  }

  // 5. 路径遍历防护
  if (/\.\.\/|\.\.\\|\.\.$/.test(cleaned)) {
    throw new Error('模型参数包含无效的路径引用');
  }

  return cleaned;
}

/**
 * 生成 OpenAI 兼容格式的错误 Response
 *
 * 格式：{ error: { message, type, param: null, code } }
 * 对齐 OpenAI API 错误规范，便于客户端统一处理。
 *
 * @param status  HTTP 状态码（如 400、404、500）
 * @param message 人类可读的错误描述
 * @param type    错误类型（如 "invalid_request_error"）
 * @param code    错误码（如 "invalid_model"）
 * @returns 可直接从路由返回的 Response 对象
 */
export function createRouterError(
  status: number,
  message: string,
  type: string,
  code: string,
): Response {
  const body: OpenAIErrorResponse = {
    error: {
      message,
      type,
      param: null,
      code,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export { validateModelName };
