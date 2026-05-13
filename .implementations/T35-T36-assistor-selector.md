# T35 + T36: Assistor Selector + Prompt Injection

## 目标
完成 Chat 前端的 Assistor 功能：角色选择器组件 + Assistor 提示词注入。

## 变更文件

### 1. `src/chat/src/api/chat.ts`
- 新增 `getAssistors()`: GET /chat/api/assistors
- 新增 `getMe()`: GET /auth/me
- 导出 `Assistor` 接口

### 2. `src/chat/src/utils/prompt-builder.ts`
- 新增 `buildDefaultSystemPrompt(userName: string)`: 仅日期+用户名

### 3. `src/chat/src/stores/chatStore.ts`
- ChatStore 新增字段：`selectedAssistorId`, `assistors`
- 新增 `loadAssistors()`, `setSelectedAssistorId()`
- `setSelectedAssistorId()` 切换 assistor 时自动更新 `selectedModel`
- 修改 `sendMessage()`:
  - 获取当前用户 username
  - 若选中 assistor：调用 `buildSystemPrompt()` 并前置 system message
  - 若无 assistor：调用 `buildDefaultSystemPrompt()` 并前置 system message
  - 使用 assistor.model（若选中）否则使用传入的 model

### 4. `src/chat/src/components/AssistorSelector.tsx` (新建)
- 自包含下拉选择器
- onMount 加载 `/chat/api/assistors`
- 第一项为 "Default"（value=""）
- 受控组件：value + onChange + disabled

### 5. `src/chat/src/components/ChatArea.tsx`
- onMount 中调用 `loadAssistors()`
- header 中嵌入 `<AssistorSelector />`

## 关键设计决策
- Assistor 选中后自动切换 model：在 `setSelectedAssistorId()` 中同步更新 `selectedModel`
- 默认 prompt 不显示角色名，仅包含日期和用户名
- `sendMessage` 中通过 `getMe()` 获取 username，失败时回退到 `'User'`
- System message 不保存到后端，仅注入到 API 请求中
