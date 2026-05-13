/** Assistor 必要字段（前端使用） */
export interface AssistorInfo {
  name: string;
  system_prompt: string;
}

/**
 * 构建完整系统提示词
 *
 * 组合格式：
 * 1. 身份介绍："你是 {name}，{userName} 的智能助手。"
 * 2. 当前日期（中文格式）："今天是 2026年5月12日。"
 * 3. 用户标识："当前用户：{userName}"
 * 4. assistor 配置的系统提示词
 */
export function buildSystemPrompt(assistor: AssistorInfo, userName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dateStr = `${year}年${month}月${day}日`;

  const parts: string[] = [
    `你是 ${assistor.name}，${userName} 的智能助手。`,
    '',
    `今天是 ${dateStr}。`,
    `当前用户：${userName}`,
    '',
    assistor.system_prompt,
  ];

  return parts.join('\n');
}

/**
 * 构建默认系统提示词（无 Assistor 时使用）
 *
 * 仅包含当前日期和用户信息。
 */
export function buildDefaultSystemPrompt(userName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dateStr = `${year}年${month}月${day}日`;

  return `今天是 ${dateStr}。\n当前用户：${userName}`;
}
