# T13 - MessageBubble 组件实施方案

## 目标
创建 `MessageBubble` 组件，支持 Markdown 渲染、代码高亮和流式光标，并更新 `ChatArea.tsx` 使用它。

## 现有分析
- 项目: SolidJS + Tailwind CSS v4 + DaisyUI 5
- `solid-markdown` v2.1.1 已安装
- `shiki` v3.6.0 已安装
- `CodeBlock` 组件尚未存在（T15 可能未完成），需要内联简单版
- `ChatArea.tsx` 当前使用内联消息渲染（第 105-141 行）

## 组件设计

### MessageBubble Props
```tsx
interface MessageBubbleProps {
  role: string;
  content: string;
  isStreaming?: boolean;
}
```

### 样式规则
- 用户消息: `chat chat-end` + `chat-bubble chat-bubble-primary`
- AI 消息: `chat chat-start` + `chat-bubble`
- 头像: `chat-image avatar` + `w-8 rounded-full bg-base-300`
- 用户图标: `User` (lucide-solid)
- Bot 图标: `Bot` (lucide-solid)

### Markdown 渲染
- 使用 `solid-markdown` 的 `renderingStrategy="reconcile"`
- `components` 覆盖:
  - `code`: 区分 inline/block，block 用 CodeBlock
  - `p`: `mb-2 last:mb-0`
  - `ul`: `list-disc list-inside mb-2`
  - `ol`: `list-decimal list-inside mb-2`
  - `blockquote`: `border-l-4 border-base-300 pl-4 italic opacity-80`
  - `pre`: 包裹样式

### 流式光标
- `isStreaming` 为 true 时，消息末尾显示 `▍`（闪烁动画）
- 使用 Tailwind `animate-pulse`

### CodeBlock (简单内联版)
- Props: `{ code: string, language?: string }`
- 暂不使用 innerHTML（MUST NOT）
- 使用 styled `<pre><code>` 渲染，等待 T15 的完整高亮版

## ChatArea.tsx 变更
- 导入 `MessageBubble`
- 替换第 105-141 行的 `<For each={store.messages}>` 内联渲染
- 传递 `isStreaming` 给最后一条 assistant 消息

## 构建验证
- `cd src/chat && bun run build`
