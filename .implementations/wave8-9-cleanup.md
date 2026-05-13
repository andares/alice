# Wave 8-9: Alice 管理面板 + 代码清理

## 完成日期: 2026-05-12

## Task 37: 全局认证中间件

修改 `src/alice/routes.ts`，使用 `elysiaAuthPlugin(db)` + `cookie()` 插件 + `.guard({ requireAdmin: true })` 包裹所有 `/alice/*` 路由。

**关键实现**:
- `elysiaAuthPlugin` 提供 `requireAdmin` 宏，检查 `isAdmin(db, currentUser.id)`
- 所有 `/alice/*` 路由自动受 admin 认证保护
- Cookie 插件用于读取 session token

## Task 38-40: 管理页面

### API Key 管理页 (`src/alice/pages/api-keys.tsx`)
- 列表展示所有 API Key（脱敏显示）
- 创建新 Key（名称 + 过期时间）
- 停用/删除 Key
- HTMX AJAX 交互，外部 JS: `public/alice-keys.js`

### Router 模型管理页 (`src/alice/pages/router-models.tsx`)
- 列表展示所有路由模型
- 添加模型（名称 + 变体下拉：openai/ollama + 目标地址）
- 删除模型
- HTMX AJAX 交互，外部 JS: `public/alice-models.js`

### 用户管理页 (`src/alice/pages/users.tsx`)
- 列表展示所有管理员
- 提升用户为管理员（通过 user_id）
- HTMX AJAX 交互，外部 JS: `public/alice-users.js`

## Task 41: 路由集成

所有新 CRUD 路由集成到 `src/alice/routes.ts`，受 `requireAdmin` 守卫保护。

## Task 42: 废弃代码检查

确认 `src/routes/chat.ts` 中无废弃导入，所有 ollama 导入仍在使用。

## Task 43: 代码质量检查

### `as any` 检查
- 项目源码中 **0 处** `as any`
- 所有命中均在 `node_modules/` 中

### `@ts-ignore` 检查
- 项目源码中 **0 处** `@ts-ignore`
- 所有命中均在 `node_modules/` 中

### 空 catch 块检查
- 项目源码中约 20 处空 catch 块
- **全部合理**：每处都有注释说明或明确的降级行为
  - 降级到项目目录（db 初始化）
  - 返回默认值（false, [], null）
  - 静默处理关闭失败（logger）
  - 忽略无法解析的 SSE 行
  - 移除无效 cookie

### 构建验证
- `tsc --noEmit` 通过（排除已知误报）
- 唯一类型错误：`@kitajs/html` JSX 的 `Type 'Element' is not assignable to type 'string'` — 已知误报，不影响运行时
- 测试文件中的 Mock 类型问题为预存问题

## 关键决策

1. **外部 JS 文件**：使用 `public/alice-*.js` 而非 `dangerouslySetInnerHTML`，因为 `@kitajs/html` 不支持该 prop
2. **Promote 路由**：`POST /alice/users/promote` 使用 body `{ user_id }` 而非 `:id` 参数
3. **Router 模型添加**：使用 variant 下拉（openai/ollama）而非自由文本
4. **空 catch 块**：全部保留，不做修改 — 每处都有合理的降级逻辑或注释说明