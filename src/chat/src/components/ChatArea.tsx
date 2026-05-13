import { createSignal, For, Show, onMount } from 'solid-js';
import { store, sendMessage, cancelStream, setModel, setStore, loadAssistors, setSelectedAssistorId } from '~/stores/chatStore';
import { getModels } from '~/api/chat';
import { Bot, Send, Square, PanelLeft, Settings } from 'lucide-solid';
import MessageBubble from './MessageBubble';
import AssistorSelector from './AssistorSelector';

export interface ChatAreaProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSettings?: () => void;
}

/**
 * 主聊天区域组件
 *
 * 功能：
 * - 顶部栏：侧边栏切换按钮（关闭时显示）+ 标题 + 模型选择器
 * - 消息区：流式消息列表，用户消息在右侧（chat-end），助手消息在左侧（chat-start）
 * - 欢迎屏：无消息时显示 Bot 图标和欢迎语
 * - 底部输入区：自适应高度文本框 + 发送/停止按钮
 * - 错误提示：DaisyUI alert-error
 */
export default function ChatArea(props: ChatAreaProps) {
  const [inputValue, setInputValue] = createSignal('');
  const [models, setModels] = createSignal<{ name: string; size: number; modified_at: string }[]>([]);

  onMount(async () => {
    try {
      const list = await getModels();
      setModels(list);
      if (!store.selectedModel && list.length > 0) {
        setModel(list[0].name);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
    loadAssistors();
  });

  const handleSend = () => {
    const text = inputValue().trim();
    if (!text || store.isStreaming) return;
    sendMessage(text, store.selectedModel);
    setInputValue('');
    const textarea = document.getElementById('chat-input') as HTMLTextAreaElement | null;
    if (textarea) textarea.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    setInputValue(el.value);
  };

  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb)} MB`;
  };

  const handleEdit = (index: number, newContent: string) => {
    setStore('messages', (msgs) => msgs.slice(0, index));
    sendMessage(newContent, store.selectedModel);
  };

  const handleRegenerate = (index: number) => {
    const userMsg = store.messages[index - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    setStore('messages', (msgs) => msgs.slice(0, index));
    sendMessage(userMsg.content, store.selectedModel);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div class="flex flex-col h-full min-w-0">
      <header class="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100 shrink-0">
        <Show when={!props.sidebarOpen}>
          <button
            class="btn btn-ghost btn-sm btn-square shrink-0"
            onClick={props.onToggleSidebar}
            title="Open sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </Show>
        <h1 class="text-lg font-semibold truncate">Alice Chat</h1>
        <div class="flex-1" />
        <AssistorSelector
          value={store.selectedAssistorId}
          onChange={(id) => setSelectedAssistorId(id)}
          disabled={store.isStreaming}
        />
        <select
          class="select select-sm select-bordered shrink-0"
          value={store.selectedModel}
          onChange={(e) => setModel(e.currentTarget.value)}
          disabled={store.isStreaming}
        >
          <For each={models()}>
            {(m) => <option value={m.name}>{m.name} ({formatSize(m.size)})</option>}
          </For>
        </select>
        <button
          class="btn btn-ghost btn-sm btn-square shrink-0"
          onClick={props.onOpenSettings}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </header>

      <Show
        when={store.messages.length > 0}
        fallback={
          <main class="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8">
            <div class="text-center max-w-md">
              <div class="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Bot size={40} class="text-primary" />
              </div>
              <h2 class="text-2xl font-bold mb-2">Welcome to Alice Chat</h2>
              <p class="text-base-content/50 leading-relaxed">
                Start a conversation by typing a message below.
                <br />
                Your AI assistant is ready to help.
              </p>
            </div>
          </main>
        }
      >
        <main class="flex-1 overflow-y-auto p-4 space-y-4">
          <For each={store.messages}>
            {(msg, index) => {
              const showRegenerate =
                msg.role === 'assistant' &&
                index() === store.messages.length - 1;
              return (
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  reasoning={(msg as { reasoning?: string }).reasoning}
                  isStreaming={
                    store.isStreaming &&
                    msg.role === 'assistant' &&
                    index() === store.messages.length - 1
                  }
                  messageIndex={index()}
                  onEdit={msg.role === 'user' ? handleEdit : undefined}
                  onRegenerate={showRegenerate ? handleRegenerate : undefined}
                  onCopy={handleCopy}
                />
              );
            }}
          </For>
        </main>
      </Show>

      <Show when={store.error}>
        <div class="alert alert-error alert-sm rounded-none shrink-0">
          <span>{store.error}</span>
        </div>
      </Show>

      <footer class="border-t border-base-300 bg-base-100 p-4 shrink-0">
        <div class="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            id="chat-input"
            class="textarea textarea-bordered flex-1 resize-none"
            rows="1"
            placeholder="Type a message…"
            value={inputValue()}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={store.isStreaming}
          />
          <Show
            when={store.isStreaming}
            fallback={
              <button
                class="btn btn-primary btn-square shrink-0"
                onClick={handleSend}
                disabled={!inputValue().trim()}
                title="Send message"
              >
                <Send size={18} />
              </button>
            }
          >
            <button
              class="btn btn-error btn-square shrink-0"
              onClick={cancelStream}
              title="Stop generating"
            >
              <Square size={18} />
            </button>
          </Show>
        </div>
      </footer>
    </div>
  );
}
