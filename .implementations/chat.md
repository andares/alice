# Alice Chat 实施方案

## 概述

为 Alice Way 添加 `/chat` 功能——基于 SolidStart 的 LLM 聊天界面，提供 DeepSeek 风格的多轮对话体验。与 `/alice` 后台完全隔离：独立技术栈、独立认证、独立数据库。

## 技术栈

- **后端**: ElysiaJS + SQLite（`bun:sqlite`，WAL 模式）+ SSE
- **前端**: SolidStart SPA（`ssr: false`, `preset: "static"`）
- **CSS**: Tailwind CSS v4（CSS-first 配置）+ DaisyUI 5（`@plugin "daisyui"`）
- **Markdown**: solid-markdown（`renderingStrategy: "reconcile"`）
- **代码高亮**: Shiki v3（客户端高亮，单例 `createHighlighter`）
- **流式 Markdown**: solid-streamdown
- **构建**: Vinxi → `.output/public/` → Elysia `staticPlugin` → `bun build --compile`

## 关键设计决策

1. **完全隔离 `/alice`**：Chat 使用独立技术栈（SolidStart vs HTMX），不引用 alice 的任何组件、样式或路由，两者通过不同前缀共存于同一 Elysia 实例。

2. **本地密码登录而非 JWT**：使用简单 session cookie 认证（`HttpOnly; Secure; SameSite=strict`），session 存储在内存 Map 中。不引入 JWT 依赖，保持轻量。

3. **SSE 通过 fetch + ReadableStream 实现**：不使用原生 `EventSource`（不支持 POST 请求和自定义 Header），手动解析 SSE `data:` 行，配合 `AbortController` 支持取消流。

4. **chatPassword 为空时禁用 chat**：若配置中 `chatPassword` 为空字符串，`/chat/api/*` 和 `/chat/` 静态资源均不挂载，chat 功能完全不可用。

5. **构建输出到 public/chat/**：SolidStart 构建产物（`.output/public/`）复制到 `public/chat/`，由 Elysia `@elysiajs/static` 服务。`GET /chat/*` fallback 返回 `index.html` 以支持 SPA 客户端路由。

6. **API 认证桥接**：新增 `/chat/api/chat` SSE 端点，内部调用现有 `ollama.ts` 的 `chat()` 函数，不经过 `/v1/chat/completions` 的 Bearer Token 认证层。

7. **Shiki 客户端高亮 + 单例模式**：高亮器在应用启动时预加载常用语言（ts, js, python, bash, json 等），避免首次渲染代码块时的长时间白屏。

8. **反应式状态管理**：使用 `solid-js/store` 的 `createStore` + `produce` + `batch()` 管理消息流式更新，避免频繁重渲染。

## 架构设计

```
浏览器 /chat/* (SPA)
  │
  ├── GET  /chat/          → staticPlugin → public/chat/index.html
  ├── GET  /chat/*.js|.css → staticPlugin → public/chat/*
  ├── GET  /chat/login     → fallback → index.html (SPA 路由)
  │
  └── /chat/api/*          → chatRoutes (Elysia)
       ├── POST /login          → 密码验证，设置 session cookie
       ├── GET  /check          → 验证 session 有效性
       ├── POST /chat           → SSE 流式聊天（验证 session）
       ├── GET  /models         → 可用模型列表
       ├── GET  /conversations  → 会话列表
       ├── POST /conversations  → 新建会话
       ├── GET  /conversations/:id/messages → 消息列表
       ├── PUT  /conversations/:id/title    → 重命名会话
       └── DELETE /conversations/:id        → 删除会话
```

**路由挂载顺序（src/index.ts）**：`/health` → `/alice` → `/chat/api/*` → `/chat/*` fallback → `authPlugin` → `/v1/*`

chat 路由在 authPlugin（Bearer Token）之前挂载，使用独立的 session cookie 认证。

## 数据库 Schema

独立数据库 `chat.db`（WAL 模式），与 `alice.db` 完全隔离。

### conversations 表

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PRIMARY KEY | UUID |
| `title` | TEXT NOT NULL | 会话标题（可由用户修改） |
| `created_at` | TEXT NOT NULL | ISO 8601 时间戳 |
| `updated_at` | TEXT NOT NULL | 最近活动时间（用于排序） |

### messages 表

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PRIMARY KEY | UUID |
| `conversation_id` | TEXT NOT NULL | 外键 → conversations.id |
| `role` | TEXT NOT NULL | `user` / `assistant` / `system` |
| `content` | TEXT NOT NULL | 消息正文 |
| `reasoning_content` | TEXT | 思考过程（仅 assistant 消息，可为 null） |
| `created_at` | TEXT NOT NULL | ISO 8601 时间戳 |

索引：`conversation_id` 列上建立索引以加速消息列表查询。

## API 设计

| 方法 | 路径 | 认证 | 请求体 | 响应 |
|------|------|------|--------|------|
| `POST` | `/chat/api/login` | 无 | `{ "password": "..." }` | `200` + Set-Cookie / `401` |
| `GET` | `/chat/api/check` | Session | — | `200` / `401` |
| `POST` | `/chat/api/chat` | Session | `{ "conversation_id", "messages", "model" }` | SSE 流 (`text/event-stream`) |
| `GET` | `/chat/api/models` | Session | — | `{ "models": [...] }` |
| `GET` | `/chat/api/conversations` | Session | — | `{ "conversations": [...] }` |
| `POST` | `/chat/api/conversations` | Session | `{ "title" }` | `{ "id", "title", ... }` |
| `GET` | `/chat/api/conversations/:id/messages` | Session | — | `{ "messages": [...] }` |
| `PUT` | `/chat/api/conversations/:id/title` | Session | `{ "title" }` | `200` |
| `DELETE` | `/chat/api/conversations/:id` | Session | — | `200` |
| `DELETE` | `/chat/api/messages/:id` | Session | — | `200` |

### SSE 流格式

```
data: {"type":"content","content":"Hello"}

data: {"type":"reasoning","content":"思考过程..."}

data: {"type":"done"}
```

每条 `data:` 行后跟 `\n\n`。前端通过 `fetch` + `ReadableStream` 解析。

## 前端组件清单

| 组件 | 文件 | 职责 |
|------|------|------|
| **Sidebar** | `components/Sidebar.tsx` | 会话列表（倒序）、搜索过滤、新建会话按钮、设置入口。移动端可折叠。 |
| **ChatArea** | `components/ChatArea.tsx` | 消息列表容器、自动滚动、空状态欢迎页。 |
| **MessageBubble** | `components/MessageBubble.tsx` | 用户/AI 消息气泡，Markdown 渲染，操作按钮（编辑、复制、重新生成、删除）。 |
| **ReasoningPanel** | `components/ReasoningPanel.tsx` | 可折叠思考过程面板，流式时自动展开，带 "Thinking..." 动画。 |
| **CodeBlock** | `components/CodeBlock.tsx` | Shiki 语法高亮 + 语言标签 + 复制按钮，支持 light/dark 主题。 |
| **InputBox** | `components/InputBox.tsx` | 多行输入（Shift+Enter 换行，Enter 发送），发送/停止按钮。 |
| **ModelSelector** | `components/ModelSelector.tsx` | 顶部模型选择器，下拉菜单显示可用模型及大小信息。 |
| **SettingsPanel** | `components/SettingsPanel.tsx` | 主题切换、流式输出开关、思考过程开关、清空会话（带确认弹窗）。 |

### 路由页面

| 路由 | 文件 | 职责 |
|------|------|------|
| `/chat/` | `routes/index.tsx` | 聊天主界面（Sidebar + ChatArea） |
| `/chat/login` | `routes/login.tsx` | 登录页（品牌区 + 密码输入 + 错误提示） |

### 状态管理

`stores/chatStore.ts`：使用 `createStore` 管理全局状态。

- `conversations` — 会话列表
- `messages` — 当前会话消息列表
- `currentConversationId` — 当前活跃会话 ID
- `isStreaming` — 是否正在接收流式输出
- `selectedModel` — 当前选中模型
- `theme` — light/dark（localStorage 持久化）
- `settings` — 流式/思考过程开关（localStorage 持久化）

### API 客户端

`api/chat.ts`：封装所有 `/chat/api/*` 调用。

- `login(password)` — POST，返回 session cookie
- `checkSession()` — GET，验证登录状态
- `chatStream(conversationId, messages, model)` — POST，返回 `{ stream, abort }` 
- `getModels()` — GET，模型列表
- `getConversations()` — GET，会话列表
- `createConversation(title)` — POST，新建会话
- `getMessages(conversationId)` — GET，消息列表
- `updateTitle(conversationId, title)` — PUT
- `deleteConversation(conversationId)` — DELETE
- `deleteMessage(messageId)` — DELETE

## 文件结构

```
src/
  config.ts                    # 新增 chatDbFile、chatPassword 配置项
  types.ts                     # 新增 ChatConfig 类型
  index.ts                     # 集成 chatRoutes + staticPlugin + fallback
  routes/
    chat.ts                    # /chat/api/* 路由（session 认证 + SSE）
  services/
    chat-db.ts                 # chat.db 初始化与 CRUD（WAL 模式）
    chat-auth.ts               # session 认证（密码验证 + token 管理）
  chat/                        # SolidStart 项目（独立 package.json）
    app.config.ts              # ssr: false, preset: static, baseURL: /chat
    tsconfig.json
    src/
      app.tsx                  # Router + base 配置
      app.css                  # @import "tailwindcss" + @plugin "daisyui"
      entry-client.tsx
      routes/
        index.tsx              # 聊天主界面
        login.tsx              # 登录页
      components/
        Sidebar.tsx
        ChatArea.tsx
        MessageBubble.tsx
        ReasoningPanel.tsx
        CodeBlock.tsx
        InputBox.tsx
        ModelSelector.tsx
        SettingsPanel.tsx
      stores/
        chatStore.ts           # createStore 全局状态
      api/
        chat.ts                # fetch 封装 + SSE 解析

public/
  chat/                        # SolidStart 构建输出（.output/public/ → 复制至此）

tests/
  unit/services/
    chat-db.test.ts            # 数据库 CRUD 单元测试
    chat-auth.test.ts          # 认证服务单元测试
  integration/routes/
    chat.test.ts               # API 路由集成测试
  e2e/
    chat.spec.ts               # Playwright E2E 测试
```

## 构建流程

```
1. cd src/chat && bun install     # 安装前端依赖
2. bun run build:chat             # SolidStart 构建 → .output/public/
3. cp -r .output/public/* public/chat/   # 复制到 Elysia 静态目录
4. ./build.sh                     # bun build --compile（不 minify，bearer external）
   → ollama-gateway 单二进制文件
```

**关键注意事项**：
- `build.sh` 已在编译前调用 `bun run build:css`，需扩展为先 `build:chat` 再 `build:css`
- `--minify` 禁用（用 `--minify-whitespace --minify-syntax`）
- `@elysiajs/bearer` 标记为 `--external`
- 编译后的二进制不嵌入 `public/` 目录，`install.sh` 需复制静态资源

## 风险与注意事项

- **chatPassword 为空**：chat 功能完全禁用。`src/index.ts` 中条件挂载 chat 路由和 staticPlugin。
- **SSE 流式响应不记录到 alice 日志**：`/chat/api/chat` 返回原生 `Response`（`text/event-stream`），`onAfterHandle` 中的 response_body 为 null，符合 AGENTS.md 中「原生 Response 不适合直接序列化落库」原则。
- **Session 存储在内存**：服务重启后所有 session 失效，用户需重新登录。对于单实例部署可接受，若需持久化可后续迁移到 SQLite。
- **Shiki 高亮器预加载**：需在客户端启动时异步加载高亮器，避免首次渲染代码块时因等待 WASM/语法文件导致白屏。
- **XSS 防护**：`solid-markdown` 默认转义 HTML，不直接使用 `innerHTML` 插入用户输入。
- **CSRF 防护**：session cookie 设置 `SameSite=strict`，POST 请求通过 cookie 自动携带 session，无需额外 CSRF token。
- **编译时 @elysiajs/bearer 必须 external**：否则 Bearer Token 认证失效，影响 `/v1/*` API（不影响 chat 的 session 认证）。
- **baseURL 配置**：`app.config.ts` 中 `baseURL: "/chat"`，SolidStart 路由和资源引用均需加上此前缀。使用 `<A>` 大写组件而非原生 `<a>` 以正确处理 base 路径。
