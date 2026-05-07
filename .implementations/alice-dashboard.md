# Alice Dashboard 实施方案

## 概述

为 Alice Way 添加 `/alice` 后台管理面板，提供状态监控、配置查看、请求日志三大功能。

## 技术栈

- **前端交互**: HTMX（无刷新导航）
- **CSS 框架**: Tailwind CSS v4 + DaisyUI 5
- **HTML 渲染**: @kitajs/html（JSX → HTML 字符串）
- **数据库**: Bun 内置 SQLite（bun:sqlite），WAL 模式
- **静态文件**: @elysiajs/static（从 public/ 目录服务）

## 关键设计决策

1. **路由挂载顺序**: `/alice` 在 `authPlugin` 之前挂载，绕过 API Key 认证
2. **请求日志**: 使用全局 `onAfterHandle`/`onError` 钩子而非 Elysia 插件，确保所有 `/v1/*` 请求都被记录
3. **日志降级**: `/var/log` 无权限时降级到 `.log/`，`/var/lib/alice-way` 无权限时降级到 `.data/`
4. **请求日志记录**: Elysia `onAfterHandle` 中的 `body` 为解析后的请求体，`response` 为路由返回值；非流式 `/v1/*` 请求会同时记录 `request_body` 与 `response_body`
5. **异常与流式限制**: `onError` 可记录大多数异常请求的 `request_body` 与错误响应体，但验证失败时仅能拿到 Elysia 当前保留的 `body`；SSE/原生 `Response` 流式响应仍无法持久化响应体，`response_body` 为 null
6. **编译部署**: `bun build --compile` 不嵌入 `public/` 目录，`install.sh` 需要复制静态资源到二进制同目录

## 文件结构

```
src/alice/
  layout.tsx          # 共享布局（侧边栏 + 内容区）
  routes.ts           # /alice 路由组 + 静态文件服务
  styles.css          # Tailwind CSS v4 + DaisyUI 5 入口
  components/          # 可复用 UI 组件
    card.tsx, field.tsx, json-textarea.tsx, menu.tsx, modal.tsx, pagination.tsx
  pages/               # 页面组件
    config.tsx, logs.tsx, status.tsx
src/middleware/
  request-logger.ts   # 请求日志（全局钩子，非插件）
src/services/
  logger-db.ts        # SQLite 日志服务
  ollama.ts            # Ollama 客户端（含 listRunningModels）
src/utils/
  logger.ts            # 日志系统（含路径降级）
src/index.ts           # 主应用入口（路由挂载顺序关键）
```

## 已知限制

- 验证失败请求的 `request_body` 依赖 Elysia 在 `onError` 中保留的 `context.body`，非法字段可能已经被剔除
- 流式响应体无法捕获：SSE 流和其他原生 `Response` body 的 `response_body` 为 null
- `SQLITE_FCNTL_PERSIST_WAL` 常量值为 10（来自 sqlite3.h）

## 本次排查与补修总结

### 问题原因

1. **旧文档结论不准确**

  之前的说明把“请求体未捕获”归因到 `onBeforeHandle` 无法读取 POST body，但请求日志实际并不依赖 `onBeforeHandle` 取 body，而是依赖全局 `onAfterHandle` / `onError` 生命周期中的 `context.body`。

2. **实现里真正缺的是响应体与异常路径**

  排查代码后发现：

  - 成功请求路径已经把 `onAfterHandle` 的 `context.body` 传给了 `request_body`，所以“成功请求的 request body 完全没实现”这个判断不成立。
  - `response_body` 在中间件里被硬编码为 `null`，即使是普通 JSON 响应也从未记录。
  - `onError` 路径只记录状态码和耗时，没有把 `context.body` 与错误响应体一起写入数据库，导致异常请求的上下文不完整。

3. **命名和注释具有误导性**

  旧注释把 `onAfterHandle` 的附加值描述成“body 参数是请求体（非响应体）”，容易让人忽略 Elysia 同时提供的 `response` / `responseValue`，进而误以为响应体能力不存在。

### 解决思路

1. **统一序列化逻辑**

  在 `src/middleware/request-logger.ts` 中抽出统一的序列化函数，对请求体和响应体都做同样的 JSON/string 截断处理，并显式跳过原生 `Response` 对象。

2. **补齐成功请求的 `response_body`**

  在 `src/index.ts` 的 `onAfterHandle` 中同时传入 `body` 与 `response`，让非流式 `/v1/*` 请求可以完整记录 `request_body` 和 `response_body`。

3. **补齐异常请求的上下文**

  在 `src/index.ts` 的 `onError` 中构造错误响应对象后，再把 `body` 和错误响应一起传给日志中间件，保证大多数异常请求也能保留 `request_body` 与 `response_body`。

4. **用真实生命周期测试替代假阳性测试**

  之前的测试只覆盖了 `logSuccessfulRequest` / `logFailedRequest` 这两个辅助函数，没有验证 Elysia 生命周期实际传入什么值。本次新增了经过真实 `onAfterHandle` / `onError` 的集成测试，直接验证入库结果，避免以后再被“测试通过但接线有误”掩盖问题。

### 官方文档

- Elysia Lifecycle: https://elysiajs.com/essential/life-cycle
- Elysia After Handle: https://elysiajs.com/essential/life-cycle#after-handle
- Elysia On Error: https://elysiajs.com/essential/life-cycle#on-error-error-handling
- Elysia Parse: https://elysiajs.com/essential/life-cycle#parse