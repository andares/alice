# Alice Way - Agent 工作指南

## 项目概况

**Alice Way** 是一个基于 **Bun** 运行时和 **ElysiaJS** 框架的 **个人代理控制台**，支持多后端模型路由（Ollama、OpenAI 等）。

**核心目标**：通过 Router 层统一调度多个 LLM 后端，提供 OpenAI 兼容的 API 接口和完整的对话管理、用户体系、管理员控制台。任何支持 OpenAI API 的客户端（如 Claude CLI、LangChain、Continue 等）均可直接接入。

**典型部署架构**：
```
客户端 → HTTPS + API Key → 公网 VPS(Alice:3000) → Router → 多后端（Ollama / OpenAI / ...）
```

**核心特性**：
- **Router 多模型路由**：统一调度多个 LLM 后端，支持模型别名映射、负载均衡、故障转移
- **Chat 对话管理**：会话持久化、消息历史、多轮对话管理（SQLite）
- **Alice Dashboard**：内置 Web 管理面板（状态页、配置页、请求日志页）
- OpenAI 兼容端点：`/v1/chat/completions`（支持流式 SSE）、`/v1/models`（保留向后兼容）
- Bearer Token 认证（API Key）
- JSON 配置文件驱动：端口、密钥、后端地址、日志级别、模型别名映射
- 异步双输出日志：控制台（带颜色）+ 文件日志（`Bun.file().writer()`）
- 编译为单二进制文件部署，systemd 服务管理（开机自启、自动重启）
- 内存占用极低（~20MB），启动毫秒级

> **Ollama 转发**：作为可选后端之一保留，`ollamaUrl` 在配置中为可选字段。Router 层可路由至任意 OpenAI 兼容后端。

## 技术栈

- **运行时**: Bun（非 Node.js）
- **框架**: ElysiaJS（类型安全、高性能）
- **语言**: TypeScript（严格模式）
- **包管理器**: Bun（lockfile 为 `bun.lock`）

## 关键命令

| 命令 | 说明 |
|------|------|
| `bun install` | 安装依赖 |
| `bun run dev` | 启动开发服务器（`bun run --watch src/index.ts`） |
| `bun run start` | 生产启动（`bun run src/index.ts`） |
| `bun run test:e2e` | E2E 测试（`playwright test tests/e2e`） |

开发服务器默认监听 **3000** 端口。

## 项目结构

```
src/
  index.ts              # 主应用入口（Elysia 组装、CORS、错误处理、优雅关闭）
  config.ts             # 配置加载与 Zod 校验（使用 Bun.file()）
  types.ts              # OpenAI/Router API 类型定义
  utils/
    logger.ts           # 异步双输出日志（Bun.file().writer()）
  middleware/
    auth.ts             # Bearer Token 认证（@elysiajs/bearer）
    request-logger.ts   # Request/response logging to SQLite
  services/
    ollama.ts           # Ollama HTTP 客户端（超时、健康检查、模型别名）
    logger-db.ts        # SQLite logging service（init, insert, query）
    chat-db.ts          # Chat session/message SQLite service
    router/             # Router-related services
  transformers/
    openai.ts           # OpenAI ↔ Ollama 格式转换（含 SSE 流式）
  routes/
    v1.ts               # /v1/chat/completions + /v1/models 路由
    auth.ts             # 认证相关路由（登录、登出、会话管理）
    chat.ts             # Chat 功能路由（对话管理、消息历史）
    router.ts           # 路由聚合与分发
  foundation/           # 基础模块（认证、用户、密钥、加密等）
    auth.ts             # 认证核心逻辑
    users.ts            # 用户管理
    administrators.ts   # 管理员管理
    assistors.ts        # 助手管理
    api-keys.ts         # API 密钥管理
    crypto.ts           # 加密工具
    csrf.ts             # CSRF 防护
    db.ts               # 数据库连接与配置
    router-models.ts    # Router 数据模型
    migrations.ts       # 数据库迁移
    bootstrap.ts        # 应用引导
    elysia-auth.ts      # Elysia 认证集成
    types.ts            # 基础类型定义
  alice/                # Alice admin dashboard
    layout.tsx          # Shared layout（sidebar + content）
    routes.ts           # /alice route handlers + static plugin
    styles.css          # Tailwind CSS v4 + DaisyUI 5 entry
    components/         # Reusable UI components
      card.tsx          # Info card with color accent
      field.tsx         # Label/value display
      json-textarea.tsx # JSON formatted display
      menu.tsx          # Sidebar navigation menu
      modal.tsx         # Full-screen modal dialog
      pagination.tsx    # HTMX-enhanced pagination
    pages/              # Page components
      config.tsx        # Config page（read-only, masked API key）
      logs.tsx          # Request logs page（table + pagination + modal）
      status.tsx        # Status page（Ollama health + models）
```

## TypeScript 配置要点

- `tsconfig.json` 显式引入 `"types": ["bun-types"]`
- 模块系统为 `ES2022`，目标 `ES2021`
- `strict: true`

## Agent 注意事项

- **必须使用 `bun` 而非 `npm`/`pnpm`/`yarn`**：所有脚本执行、包安装、运行都通过 Bun。
- **测试框架**：使用 `bun:test` 运行单元测试，使用 `playwright` 运行 E2E 测试。
- **无 Lint/Format 工具**：没有 ESLint、Prettier 等配置，不要假设存在。
- **Bun 运行时特性**：Bun 内置了 TypeScript 支持，无需额外编译步骤即可直接运行 `.ts` 文件。
- **遇到不熟悉的 API/库时，积极使用搜索工具查文档，禁止瞎猜**：优先用 context7、firecrawl-search 等工具查官方文档，不确定的行为通过搜索验证后再实现。

## Bun 优先原则

**所有服务端 TypeScript 实现必须基于 Bun 运行时，优先使用 Bun 原生 API；客户端 SolidStart 部分也必须基于 Bun 工具链进行开发。**

### 服务端（ElysiaJS）Bun API 使用规范

| 场景 | 必须使用 | 禁止使用 |
|------|---------|----------|
| HTTP 请求 | Bun 内置 `fetch` | Node.js `http`/`https` 模块 |
| 文件读取 | `Bun.file()` | `fs.readFileSync()` |
| 文件写入 | `Bun.write()` 或 `Bun.file().writer()` | `fs.writeFileSync()` |
| SQLite | `bun:sqlite` (`Database` 类) | `better-sqlite3`、`sqlite3` 等其他库 |
| 密码哈希 | `Bun.password.hash()` / `Bun.password.verify()` | `bcryptjs`、`argon2` 等外部库（bcrypt 格式天然支持） |
| 加密/JWT | `crypto.subtle`（Web Crypto API） | `jsonwebtoken`、`jose` 等外部 JWT 库 |
| UUID/随机值 | `crypto.randomUUID()` | `uuid` 库 |
| 文件路径 | `import { join, dirname } from 'node:path'` | `path-browserify` 等替代品 |
| 流处理 | `ReadableStream` + `WritableStream`（Web 标准） | Node.js `Stream` API |
| 进程环境 | `Bun.env`、`process.env` | 无限制 |
| 子进程 | `Bun.spawn()` / `Bun.spawnSync()` | Node.js `child_process`（除非 Bun API 不支持的功能） |

### 客户端（SolidStart）构建工具链规范

| 场景 | 必须使用 | 禁止使用 |
|------|---------|----------|
| 包管理 | `bun install`、`bun add`、`bun remove` | `npm`/`pnpm`/`yarn` |
| 脚本执行 | `bunx --bun <command>`（如 `bunx --bun vinxi build`） | `npx`、`pnpm dlx` |
| 开发服务器 | `bun run dev`（内部调用 vinxi） | `npm run dev` |
| 生产构建 | `bun run build`（内部调用 vinxi） | `npm run build` |
| TypeScript | Bun 内置 TS 编译 | `tsc` 命令行（仅用于类型检查 `--noEmit`） |
| CSS 构建 | `bunx --bun @tailwindcss/cli` | Node.js 版本的 Tailwind CLI |

### 运行时检测

在需要区分运行时的场景，使用以下模式：

```typescript
// 检测 Bun 运行时
if (typeof Bun !== 'undefined') {
  // Bun 专属代码路径
}
```

### 为什么用 Bun 原生 API

- **零外部依赖**：`Bun.password`、`bun:sqlite`、`Bun.file()` 等均内置，减少依赖树体积
- **启动速度**：Bun 原生 API 经过深度优化，比 Node.js 生态库快 4-10x
- **编译友好**：编译为单二进制时，Bun 内置 API 自动打包，外部库可能有时不兼容
- **一致性**：统一使用 Bun API 确保开发、测试、编译、部署各阶段行为一致

## Elysia 生命周期关键知识

- **`onAfterHandle` 里同时有请求体和响应值**：`context.body` 是解析后的请求体，`context.response` / `context.responseValue` 是路由返回值；做请求日志时不要把两者混为一谈。
- **`onError` 里通常仍可访问 `context.body`**：处理器抛错时可继续记录请求体，但验证失败时 Elysia 暴露的是当前保留的 body，非法字段可能已经被剔除。
- **原生 `Response` 不适合直接序列化落库**：SSE、文件流和其他流式响应通常表现为原生 `Response` 或流对象，请求日志应将这类 `response_body` 视为不可捕获而不是强行消费。
- **排查生命周期问题时优先做最小真实验证**：不要只看类型签名或辅助函数测试；应先跑一个最小 Elysia 片段，确认 `onAfterHandle` / `onError` 实际拿到的字段和值。
- **相关官方文档**：https://elysiajs.com/essential/life-cycle

## 部署文件

| 文件 | 说明 |
|------|------|
| `config.example.json` | 配置文件示例（复制到 `/etc/alice-way/config.json`），包含 `dbFile` 配置项 |
| `build.sh` | 编译为独立二进制（`bun build --compile`） |
| `install.sh` | 安装为 systemd 服务（需 root） |
| `alice.service` | systemd 服务模板 |
| `Dockerfile` | 多阶段构建镜像 |
| `.dockerignore` | 构建排除规则 |
| `docker-compose.yml` | Docker 容器编排 |

## Alice Dashboard 说明

- **技术栈**: HTMX + Tailwind CSS v4 + DaisyUI 5 + @kitajs/html (JSX)
- **无内置认证**: `/alice` 端点没有内置认证，生产环境通过 nginx 反向代理 + HTTP Basic Auth 保护
- **SQLite WAL 模式**: 数据库使用 WAL 模式以支持并发写入
- **请求/响应体截断**: 超过 10KB 的请求/响应体会被截断存储
- **访问路径**:
  - `/alice` — 状态页（后端健康检查 + 模型列表）
  - `/alice/config` — 配置查看页（只读，API key 已脱敏）
  - `/alice/logs` — 请求日志页（分页表格，点击行显示 JSON 详情弹窗）
- **日志分页**: 每页 30 条，最多 50 页

## 编译注意事项

- **不使用 `--minify`**：会导致 Elysia 运行时崩溃，使用 `--minify-whitespace --minify-syntax` 替代
- **`@elysiajs/bearer` 必须标记为 `--external`**：否则编译后认证失效
- **目标机器需支持 AVX2**：Bun 编译后的二进制有此硬件要求
- **二进制名称**：编译输出为 `alice`（非 `ollama-gateway`）
- **开发模式**：直接 `bun run dev`，Bun 自动加载 CWD 下的 `.env` 文件
- **配置路径优先级**（三级回退）：
  1. 环境变量 `CONFIG_PATH`（最高优先级）
  2. 系统路径 `/etc/alice-way/config.json`
  3. 本地路径 `./config.json`（若不存在则自动创建）

## 实现规范（通用）

参照根目录上级 `AGENTS.md` 中的通用规则：
- 注释使用中文
- 日志信息使用英文
- 命令行输出使用英文
- 复杂任务需在 `.implementations/` 目录下创建方案文档

## es-toolkit 优先

本项目已安装 [es-toolkit](https://es-toolkit.dev/)，所有通用工具函数应优先使用 es-toolkit 提供的能力。

### 使用原则

- **数组/对象/字符串/函数操作优先使用 es-toolkit**，如 `pick`、`omit`、`debounce`、`throttle`、`cloneDeep`、`uniq`、`groupBy`、`sortBy`、`chunk`、`sample`、`random`、`capitalize`、`camelCase` 等
- **禁止重复造轮子**：不得手写 debounce、pick、omit、throttle 等已有 es-toolkit 提供的函数
- **禁止引入其他工具库**：不得引入 lodash、underscore、ramda 等其他工具库，es-toolkit 已覆盖绝大部分场景

### 导入方式

```typescript
import { debounce, pick, omit, groupBy, cloneDeep } from 'es-toolkit'
```

按需导入，支持 tree-shaking。详细 API 参考：https://es-toolkit.dev/reference/

### es-toolkit 不覆盖的场景

某些领域专用函数不属于 es-toolkit 范畴，**不需要**用 es-toolkit 替代：
- Zod schema 定义与校验（`z.object()`, `z.string()` 等）
- Elysia 框架生命周期函数
- Bun 运行时 API（`Bun.file()`, `Bun.write()` 等）

## Implementations

- [Alice Dashboard](.implementations/alice-dashboard.md) — 后台管理面板实施方案
- [T10 ChatArea](.implementations/T10-chat-area.md) — ChatArea 基础组件实施方案
- [Alice Chat](.implementations/chat.md) — /chat 功能完整实施方案
- [T13 MessageBubble](.implementations/T13-message-bubble.md) — 消息气泡组件实施方案
- [T35-T36 Assistor Selector](.implementations/T35-T36-assistor-selector.md) — Assistor 选择器 + 提示词注入实施方案
- [Wave 8-9 管理面板+清理](.implementations/wave8-9-cleanup.md) — Alice 管理面板认证/CRUD + 代码质量检查
