import { createStore } from 'solid-js/store';
import { batch } from 'solid-js';
import * as api from '~/api/chat';
import { buildSystemPrompt, buildDefaultSystemPrompt } from '~/utils/prompt-builder';
import type { Assistor } from '~/api/chat';

export interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatStore {
  conversations: Conversation[];
  messages: Message[];
  currentConversationId: string | null;
  isStreaming: boolean;
  selectedModel: string;
  abortController: AbortController | null;
  theme: string;
  error: string | null;
  selectedAssistorId: string | null;
  assistors: Assistor[];
}

export const [store, setStore] = createStore<ChatStore>({
  conversations: [],
  messages: [],
  currentConversationId: null,
  isStreaming: false,
  selectedModel: '',
  abortController: null,
  theme: 'light',
  error: null,
  selectedAssistorId: null,
  assistors: [],
});

/** 从后端加载会话列表 */
export async function loadConversations() {
  try {
    const conversations = await api.getConversations();
    setStore('conversations', conversations);
  } catch (err) {
    setStore('error', String(err));
  }
}

/** 创建新会话：清空消息和当前会话 ID，准备全新的聊天 */
export function createConversation() {
  batch(() => {
    setStore('messages', []);
    setStore('currentConversationId', null);
    setStore('error', null);
  });
}

/** 选择已有会话并加载其消息历史 */
export async function selectConversation(id: string) {
  setStore('currentConversationId', id);
  setStore('error', null);
  try {
    const messages = await api.getMessages(id);
    setStore('messages', messages);
  } catch (err) {
    setStore('error', String(err));
  }
}

/** 加载 Assistor 列表 */
export async function loadAssistors() {
  try {
    const list = await api.getAssistors();
    setStore('assistors', list);
  } catch (err) {
    console.error('Failed to load assistors:', err);
  }
}

/** 设置当前选中的 Assistor，同时自动切换其绑定的 model */
export function setSelectedAssistorId(id: string | null) {
  setStore('selectedAssistorId', id);
  if (id) {
    const assistor = store.assistors.find((a) => String(a.id) === id);
    if (assistor && assistor.model) {
      setStore('selectedModel', assistor.model);
    }
  }
}

/** 发送消息并启动流式接收 */
export async function sendMessage(content: string, model: string) {
  cancelStream();

  const controller = new AbortController();
  let convId = store.currentConversationId;

  try {
    // 1. 如果没有当前会话，先创建新会话
    if (!convId) {
      const title = content.slice(0, 50) || 'New Chat';
      const conv = await api.createConversation(title, model);
      convId = conv.id;
      batch(() => {
        setStore('currentConversationId', convId);
      });
      loadConversations();
    }

    // 2. 保存用户消息到后端
    await api.saveMessage(convId, 'user', content);

    // 3. 获取当前用户名并构建系统提示词
    let userName = 'User';
    try {
      const me = await api.getMe();
      userName = me.user.username;
    } catch {
      // 回退到默认值
    }

    const assistor = store.assistors.find(
      (a) => String(a.id) === store.selectedAssistorId,
    );
    const systemPrompt = assistor
      ? buildSystemPrompt(
          { name: assistor.name, system_prompt: assistor.system_prompt },
          userName,
        )
      : buildDefaultSystemPrompt(userName);

    const modelToUse = assistor ? assistor.model : model;

    // 4. 构建发送给 API 的消息列表
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...store.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content },
    ];

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    batch(() => {
      setStore('abortController', controller);
      setStore('isStreaming', true);
      setStore('error', null);
      setStore('messages', (msgs) => [...msgs, userMsg, assistantMsg]);
    });

    let fullContent = '';

    // 5. 调用 Router 获取流式回复
    for await (const chunk of api.sendToRouter(
      modelToUse,
      apiMessages,
      controller.signal,
    )) {
      const deltaContent = chunk.choices?.[0]?.delta?.content;
      if (deltaContent) {
        fullContent += deltaContent;
        setStore(
          'messages',
          store.messages.length - 1,
          'content',
          (c) => c + deltaContent,
        );
      }
    }

    // 6. streaming 完成后保存 assistant 回复到 chat 后端
    if (fullContent && convId) {
      await api.saveMessage(convId, 'assistant', fullContent);
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      setStore('error', String(err));
    }
  } finally {
    batch(() => {
      setStore('isStreaming', false);
      setStore('abortController', null);
    });
  }
}

/** 取消当前流式请求 */
export function cancelStream() {
  const controller = store.abortController;
  if (controller) {
    controller.abort();
    setStore('abortController', null);
  }
}

/** 追加一条消息到消息列表末尾 */
export function addMessage(msg: Message) {
  setStore('messages', (msgs) => [...msgs, msg]);
}

/** 更新最后一条消息的内容 */
export function updateLastMessage(content: string) {
  if (store.messages.length === 0) return;
  setStore('messages', store.messages.length - 1, 'content', content);
}

/** 设置流式状态 */
export function setStreaming(v: boolean) {
  setStore('isStreaming', v);
}

/** 设置当前选中模型 */
export function setModel(model: string) {
  setStore('selectedModel', model);
}

/** 设置错误信息 */
export function setError(err: string) {
  setStore('error', err);
}

/** 清除错误信息 */
export function clearError() {
  setStore('error', null);
}
