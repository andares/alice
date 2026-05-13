# T10 - ChatArea 基础组件实施方案

## 目标
创建 `src/chat/src/components/ChatArea.tsx`，并重构 `src/chat/src/routes/index.tsx` 以集成 ChatArea + Sidebar。

## 结构拆分
- `src/chat/src/components/Sidebar.tsx` — 从现有 index.tsx 提取的 Sidebar 组件（保持原有功能不变）
- `src/chat/src/components/ChatArea.tsx` — 新的聊天区组件
- `src/chat/src/routes/index.tsx` — 仅负责布局骨架和 `sidebarOpen` 状态管理

## ChatArea 功能点
1. **顶部栏**（固定在顶部）
   - Sidebar toggle 按钮（接收 `onToggleSidebar` prop）
   - 当前会话标题（从 `store.currentConversationId` 推断，空会话显示 "New Chat"）
   - 模型选择器（DaisyUI dropdown，列出 `store.models` 或本地 signal，选择后 `setModel`）

2. **消息列表区**（`flex-1 overflow-y-auto`，居中 `max-w-3xl`）
   - 使用 Solid `<For>` 渲染 `store.messages`
   - 用户消息：`chat chat-end` + `chat-bubble chat-bubble-primary`
   - AI 消息：`chat chat-start` + `chat-bubble`
   - 每条消息带 avatar（User / Bot 图标）
   - 滚动到底部（`onMount` 和消息更新时）

3. **输入框区**（底部固定）
   - textarea 自动增高（`el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'`，max 200px）
   - Enter 发送，Shift+Enter 换行
   - 发送按钮（lucide-solid Send）
   - 发送后清空输入框并恢复高度

4. **空状态**
   - 无消息时显示欢迎页：Bot 图标 + "Welcome to Alice Chat" + 描述文字
   - `items-center justify-center`

5. **流式状态**
   - `store.isStreaming` 时：发送按钮变为 Stop 按钮（Square 图标），点击 `cancelStream()`
   - 输入框禁用

6. **生命周期**
   - `onMount` 时调用 `loadConversations()` 和 `getModels()`
   - 模型列表如 store 无字段，使用本地 `createSignal`

## 依赖
- `solid-js`: `createSignal`, `onMount`, `For`, `createEffect`
- `lucide-solid`: `Send`, `Square`, `Bot`, `User`, `PanelLeft`, `PanelLeftClose`, `ChevronDown`
- DaisyUI 5 classes: `textarea`, `btn`, `card`, `avatar`, `dropdown`, `badge`, `chat`, `chat-bubble`

## 注意事项
- 不实现 Markdown 渲染、代码高亮、思考面板
- 不修改 stores/chatStore.ts 或 api/chat.ts
- 模型选择器先用占位实现（store 无 models 字段，用本地 signal）
- 保持 DeepSeek 风格：简洁专业
