# Alice Way - Agent 工作指南

## 项目概况

**Alice Way** 是一个基于 **Bun** 运行时和 **ElysiaJS** 框架的 **LLM Portal** 服务，其中包括了对`Ollama`转发`Open AI API`的支持。

**包括目标**：安全暴露内网 Ollama 服务到公网，提供 OpenAI 兼容的 API 接口，避免直接暴露 Ollama 原生端口（11434）。任何支持 OpenAI API 的客户端（如 Claude CLI、LangChain、Continue 等）均可直接接入。

**典型部署架构**：
```
客户端 → HTTPS + API Key → 公网 VPS(Alice:3000) → frp 内网穿透 → 内网 Ollama(11434)
```

**核心特性**：
- OpenAI 兼容端点：`/v1/chat/completions`（支持流式 SSE）、`/v1/models`
- Bearer Token 认证（API Key）
- JSON 配置文件驱动：端口、密钥、后端地址、日志级别、模型别名映射
- 异步双输出日志：控制台（带颜色）+ 文件日志（`Bun.file().writer()`）
- 编译为单二进制文件部署，systemd 服务管理（开机自启、自动重启）
- 内存占用极低（~20MB），启动毫秒级

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
| `bun run src/index.ts` | 直接运行 |

开发服务器默认监听 **3000** 端口。

## 项目结构

```
src/
  index.ts              # 主应用入口（Elysia 组装、CORS、错误处理、优雅关闭）
  config.ts             # 配置加载与 Zod 校验（使用 Bun.file()）
  types.ts              # OpenAI/Ollama API 类型定义
  utils/
    logger.ts           # 异步双输出日志（Bun.file().writer()）
  middleware/
    auth.ts             # Bearer Token 认证（@elysiajs/bearer）
    request-logger.ts   # Request/response logging to SQLite
  services/
    ollama.ts           # Ollama HTTP 客户端（超时、健康检查、模型别名）
    logger-db.ts        # SQLite logging service（init, insert, query）
  transformers/
    openai.ts           # OpenAI ↔ Ollama 格式转换（含 SSE 流式）
  routes/
    v1.ts               # /v1/chat/completions + /v1/models 路由
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
- **无测试框架**：`package.json` 中的 `test` 脚本为占位符，尚未配置测试工具。
- **无 Lint/Format 工具**：没有 ESLint、Prettier 等配置，不要假设存在。
- **极小项目**：目前只有一个入口文件。新增功能时直接在 `src/` 下扩展即可，无需复杂目录结构。
- **Bun 运行时特性**：Bun 内置了 TypeScript 支持，无需额外编译步骤即可直接运行 `.ts` 文件。

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
| `ollama-gateway.service` | systemd 服务模板 |

## Alice Dashboard 说明

- **技术栈**: HTMX + Tailwind CSS v4 + DaisyUI 5 + @kitajs/html (JSX)
- **无内置认证**: `/alice` 端点没有内置认证，生产环境通过 nginx 反向代理 + HTTP Basic Auth 保护
- **SQLite WAL 模式**: 数据库使用 WAL 模式以支持并发写入
- **请求/响应体截断**: 超过 10KB 的请求/响应体会被截断存储
- **访问路径**:
  - `/alice` — 状态页（Ollama 健康检查 + 模型列表）
  - `/alice/config` — 配置查看页（只读，API key 已脱敏）
  - `/alice/logs` — 请求日志页（分页表格，点击行显示 JSON 详情弹窗）
- **日志分页**: 每页 30 条，最多 50 页

## 编译注意事项

- **不使用 `--minify`**：会导致 Elysia 运行时崩溃，使用 `--minify-whitespace --minify-syntax` 替代
- **`@elysiajs/bearer` 必须标记为 `--external`**：否则编译后认证失效
- **目标机器需支持 AVX2**：Bun 编译后的二进制有此硬件要求
- **开发模式**：使用 `CONFIG_PATH=./config.example.json bun run dev` 启动（避免 /var/log 权限问题）

## 实现规范（通用）

参照根目录上级 `AGENTS.md` 中的通用规则：
- 注释使用中文
- 日志信息使用英文
- 命令行输出使用英文
- 复杂任务需在 `.implementations/` 目录下创建方案文档

## Implementations

- [Alice Dashboard](.implementations/alice-dashboard.md) — 后台管理面板实施方案
