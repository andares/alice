/**
 * Alice Chat API 客户端
 *
 * 所有请求携带 credentials: 'include' 以自动发送 cookie（auth_token）。
 * 后端基础路径为 /chat/api，通过 Vite 代理或同源访问。
 * Router 端点为 /router/<model>/chat/completions。
 */

const API_BASE = '/chat/api';

/** 通用 fetch 选项：携带 cookie */
const baseInit: RequestInit = { credentials: 'include' };

/**
 * 用户登录
 * POST /auth/login → { id, username } 并设置 auth_token cookie
 */
export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/auth/login', {
    ...baseInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({ error: 'Login failed' }));
  if (data.error) return { ok: false, error: data.error };
  return { ok: true };
}

/**
 * 标准 OpenAI SSE 流式聊天
 * POST /router/<modelName>/chat/completions → text/event-stream
 *
 * 使用异步生成器逐块解析 SSE 行，支持 AbortSignal 取消。
 * SSE 格式：data: {"choices":[{"delta":{"content":"..."}}]} → data: [DONE]
 */
export async function* sendToRouter(
  modelName: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<{
  choices?: Array<{
    index?: number;
    delta?: { role?: string; content?: string };
    finish_reason?: string | null;
  }>;
}> {
  const res = await fetch(
    `/router/${encodeURIComponent(modelName)}/chat/completions`,
    {
      ...baseInit,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: true,
      }),
      signal,
    },
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Chat failed' }));
    throw new Error(errData.error || `Chat request failed (${res.status})`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') return;

        try {
          const event = JSON.parse(dataStr);
          yield event;
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

/**
 * 获取可用模型列表
 * GET /chat/api/models → { models: [...] }
 */
export async function getModels(): Promise<
  { name: string; size: number; modified_at: string }[]
> {
  const res = await fetch(`${API_BASE}/models`, baseInit);
  if (!res.ok) throw new Error('Failed to fetch models');
  const data = await res.json();
  return data.models ?? [];
}

/**
 * 创建新会话
 * POST /chat/api/conversations → { conversation: {...} }
 */
export async function createConversation(
  title: string,
  model: string,
): Promise<{ id: string; title: string; created_at: string; updated_at: string }> {
  const res = await fetch(`${API_BASE}/conversations`, {
    ...baseInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, model }),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  const data = await res.json();
  const conv = data.conversation;
  return {
    id: conv.id,
    title: conv.title,
    created_at: String(conv.created_at),
    updated_at: String(conv.updated_at),
  };
}

/**
 * 获取会话列表
 * GET /chat/api/conversations → { conversations: [...] }
 */
export async function getConversations(): Promise<
  { id: string; title: string; created_at: string; updated_at: string }[]
> {
  const res = await fetch(`${API_BASE}/conversations`, baseInit);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  const data = await res.json();
  return data.conversations ?? [];
}

/**
 * 获取会话消息列表
 * GET /chat/api/conversations/:id/messages → { messages: [...] }
 */
export async function getMessages(
  conversationId: string,
): Promise<
  { id: string; role: string; content: string; created_at: string }[]
> {
  const res = await fetch(
    `${API_BASE}/conversations/${conversationId}/messages`,
    baseInit,
  );
  if (!res.ok) throw new Error('Failed to fetch messages');
  const data = await res.json();
  return data.messages ?? [];
}

/**
 * 保存消息
 * POST /chat/api/conversations/:id/messages → { message: {...} }
 */
export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/conversations/${conversationId}/messages`,
    {
      ...baseInit,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content }),
    },
  );
  if (!res.ok) throw new Error('Failed to save message');
}

/**
 * 删除会话
 * DELETE /chat/api/conversations/:id → { success: true }
 */
export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    ...baseInit,
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

/**
 * 更新会话标题
 * PUT /chat/api/conversations/:id/title → { conversation: {...} }
 */
export async function updateTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/title`, {
    ...baseInit,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to update title');
}

/** Assistor 对象 */
export interface Assistor {
  id: number;
  name: string;
  model: string;
  system_prompt: string;
  created_by: number;
  created_at: number;
  updated_at: number;
}

/**
 * 获取 Assistor 列表
 * GET /chat/api/assistors → { assistors: [...] }
 */
export async function getAssistors(): Promise<Assistor[]> {
  const res = await fetch(`${API_BASE}/assistors`, baseInit);
  if (!res.ok) throw new Error('Failed to fetch assistors');
  const data = await res.json();
  return data.assistors ?? [];
}

/**
 * 获取当前登录用户信息
 * GET /auth/me → { user: {...}, isAdmin: boolean }
 */
export async function getMe(): Promise<{
  user: {
    id: number;
    username: string;
    password_updated_at: number | null;
    created_at: number;
    updated_at: number;
  };
  isAdmin: boolean;
}> {
  const res = await fetch('/auth/me', baseInit);
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

/**
 * 检查当前认证是否有效
 * 通过请求 /auth/me 端点判断
 */
export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch('/auth/me', baseInit);
    return res.ok;
  } catch {
    return false;
  }
}
