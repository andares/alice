import { Show, createSignal } from 'solid-js';
import { SolidMarkdown } from 'solid-markdown';
import { Bot, User, Copy, Check, Pencil, RefreshCw, X } from 'lucide-solid';
import CodeBlock from './CodeBlock';
import ReasoningPanel from './ReasoningPanel';

export interface MessageBubbleProps {
  role: string;
  content: string;
  isStreaming?: boolean;
  reasoning?: string;
  messageIndex?: number;
  onEdit?: (index: number, newContent: string) => void;
  onRegenerate?: (index: number) => void;
  onCopy?: (content: string) => void;
}

/**
 * 消息气泡组件
 *
 * 功能：
 * - 用户消息：蓝色气泡（chat-end + chat-bubble-primary），纯文本渲染
 * - AI 消息：左侧气泡（chat-start），用 solid-markdown 渲染 Markdown
 * - 代码块：用 CodeBlock 组件渲染
 * - 流式输出时消息末尾显示闪烁光标 ▍
 * - 头像：User 图标 / Bot 图标
 * - 悬停操作按钮：Copy / Edit（用户消息）或 Copy / Regenerate（AI 消息）
 * - 编辑模式：textarea + Save / Cancel
 */
export default function MessageBubble(props: MessageBubbleProps) {
  const isUser = () => props.role === 'user';
  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.content);
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.content);
      props.onCopy?.(props.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEdit = () => {
    setEditContent(props.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    props.onEdit?.(props.messageIndex, editContent());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(props.content);
  };

  const handleRegenerate = () => {
    props.onRegenerate?.(props.messageIndex);
  };

  return (
    <div
      class="chat"
      classList={{
        'chat-end': isUser(),
        'chat-start': !isUser(),
      }}
    >
      <div class="chat-image avatar">
        <div class="w-8 rounded-full bg-base-300 flex items-center justify-center">
          <Show
            when={isUser()}
            fallback={<Bot size={16} class="text-primary" />}
          >
            <User size={16} class="text-base-content" />
          </Show>
        </div>
      </div>
      <div class="chat-header">
        <span class="text-xs opacity-50">
          {isUser() ? 'You' : 'Assistant'}
        </span>
      </div>
      <div
        class="chat-bubble relative group"
        classList={{
          'chat-bubble-primary': isUser(),
        }}
      >
        <Show when={!props.isStreaming && !isEditing()}>
          <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-base-100/80 backdrop-blur-sm rounded p-0.5 z-10">
            <Show when={isUser()}>
              <button
                class="btn btn-ghost btn-xs btn-square"
                onClick={handleEdit}
                title="Edit"
              >
                <Pencil size={12} />
              </button>
            </Show>
            <Show when={!isUser() && props.onRegenerate}>
              <button
                class="btn btn-ghost btn-xs btn-square"
                onClick={handleRegenerate}
                title="Regenerate"
              >
                <RefreshCw size={12} />
              </button>
            </Show>
            <button
              class="btn btn-ghost btn-xs btn-square"
              onClick={handleCopy}
              title="Copy"
            >
              <Show when={copied()} fallback={<Copy size={12} />}>
                <Check size={12} class="text-success" />
              </Show>
            </button>
          </div>
        </Show>

        <Show when={isEditing()}>
          <div class="flex flex-col gap-2 min-w-[200px]">
            <textarea
              class="textarea textarea-bordered w-full min-h-[80px] text-sm bg-base-100 text-base-content"
              value={editContent()}
              onInput={(e) => setEditContent(e.currentTarget.value)}
            />
            <div class="flex gap-2 justify-end">
              <button
                class="btn btn-ghost btn-xs"
                onClick={handleCancel}
              >
                <X size={12} /> Cancel
              </button>
              <button
                class="btn btn-primary btn-xs"
                onClick={handleSave}
              >
                <Check size={12} /> Save
              </button>
            </div>
          </div>
        </Show>

        <Show when={!isEditing()}>
          <Show
            when={props.content}
            fallback={<span class="loading loading-dots loading-xs" />}
          >
            <Show when={props.reasoning}>
              <ReasoningPanel
                content={props.reasoning!}
                isStreaming={props.isStreaming}
              />
            </Show>
            <Show
              when={!isUser()}
              fallback={
                <>
                  {props.content}
                  <Show when={props.isStreaming}>
                    <span class="animate-pulse">▍</span>
                  </Show>
                </>
              }
            >
              <SolidMarkdown
                renderingStrategy="reconcile"
                components={{
                  code: (p: {
                    inline?: boolean;
                    class?: string;
                    className?: string;
                    children?: any;
                  }) => {
                    const lang = (p.class || p.className || '')
                      .replace('language-', '')
                      .replace('lang-', '') || 'text';
                    if (p.inline) {
                      return (
                        <code class="bg-base-300 px-1 py-0.5 rounded text-sm">
                          {p.children}
                        </code>
                      );
                    }
                    return <CodeBlock code={String(p.children)} lang={lang} />;
                  },
                  p: (p: { children?: any }) => (
                    <p class="mb-2 last:mb-0">{p.children}</p>
                  ),
                  ul: (p: { children?: any }) => (
                    <ul class="list-disc list-inside mb-2">{p.children}</ul>
                  ),
                  ol: (p: { children?: any }) => (
                    <ol class="list-decimal list-inside mb-2">{p.children}</ol>
                  ),
                  blockquote: (p: { children?: any }) => (
                    <blockquote class="border-l-4 border-base-300 pl-4 italic opacity-80 mb-2">
                      {p.children}
                    </blockquote>
                  ),
                  pre: (p: { children?: any }) => (
                    <pre class="mb-2">{p.children}</pre>
                  ),
                  h1: (p: { children?: any }) => (
                    <h1 class="text-xl font-bold mb-2">{p.children}</h1>
                  ),
                  h2: (p: { children?: any }) => (
                    <h2 class="text-lg font-bold mb-2">{p.children}</h2>
                  ),
                  h3: (p: { children?: any }) => (
                    <h3 class="text-base font-bold mb-2">{p.children}</h3>
                  ),
                  a: (p: { href?: string; children?: any }) => (
                    <a href={p.href} class="link link-primary" target="_blank" rel="noopener noreferrer">
                      {p.children}
                    </a>
                  ),
                  hr: () => <hr class="my-4 border-base-300" />,
                }}
              >
                {props.content}
              </SolidMarkdown>
              <Show when={props.isStreaming}>
                <span class="animate-pulse">▍</span>
              </Show>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}


