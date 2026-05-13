# E2E Testing Guide

开发者指南：如何在 Alice Way 项目中编写和运行端到端（E2E）测试。

---

## 运行 E2E 测试

### 完整运行（如配置了 Ollama）

```bash
bun run test:e2e
```

> **提示**: Bun 会自动加载项目根目录下的 `.env` 文件。可通过 `CONFIG_PATH` 环境变量指定配置文件路径，例如 `CONFIG_PATH=./config.local.json bun run test:e2e`。

### 跳过 Ollama 依赖测试（本地开发推荐）

```bash
SKIP_OLLAMA=1 bun run test:e2e
```

### 运行特定测试

```bash
bun run test:e2e --grep "Login Page"
```

> **注意**: E2E 测试通过 Playwright 的 `webServer` 配置自动启动应用。首次运行前请确保已构建 Chat 前端：
>
> ```bash
> bun run build:chat
> ```

---

## 编写 E2E 测试

### 文件位置

所有 E2E 测试文件放在 `tests/e2e/` 目录下。

### 命名规范

- 文件名：`*.spec.ts`
- 示例：`chat.spec.ts`、`login.spec.ts`

### 测试结构

使用 `test.describe()` 组织测试套件：

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/some-path');
    await expect(page.locator('h1')).toContainText('Expected Title');
  });
});
```

### 登录前置操作

使用 `test.beforeEach()` 或辅助函数进行登录：

```typescript
async function loginAndGoToChat(page: Page) {
  await page.goto('/chat/login');
  await page.fill('input[type="password"]', 'dev-password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/chat/**');
}
```

### 标记 Ollama 依赖测试（如已配置）

依赖 Ollama 的测试需要添加条件跳过标记：

```typescript
const skipOllama = process.env.SKIP_OLLAMA === '1';

test('should send message', async ({ page }) => {
  test.skip(skipOllama, 'Requires Ollama');
  // ... test logic
});
```

---

## Fixtures 和工具

`tests/fixtures/` 目录提供测试辅助工具：

| 文件 | 用途 |
|------|------|
| `config.mock.ts` | 模拟配置对象，用于单元/集成测试 |
| `request-factories.ts` | 创建 OpenAI 请求对象的工厂函数 |
| `ollama-responses.ts` | 模拟 Ollama API 响应的 fixture 数据 |

> E2E 测试通常不需要这些 fixtures，但编写新的集成测试时可参考。

---

## 常见问题排查

### "Timeout waiting for server"

应用启动失败。检查：

1. 数据库 schema 是否正确：删除 `.data/` 目录后重试
2. 端口 3000 是否被占用

### "Port 3000 already in use"

```bash
# 查找并关闭占用进程
lsof -ti:3000 | xargs kill
```

### 测试不稳定（flaky）

1. 检查选择器是否使用了稳定的属性（如 `id`、`data-testid`）
2. 适当增加 `timeout` 值
3. Playwright 已配置重试机制（`retries: 1`）

### 登录页测试失败（找不到 h1）

登录页 UI 可能已更新。检查 `src/chat/src/routes/login.tsx` 确认当前 DOM 结构。

---

## 目录结构

```
tests/
├── e2e/                    # E2E 测试（Playwright）
│   └── chat.spec.ts        # Chat 功能端到端测试
├── fixtures/               # 测试辅助数据
│   ├── config.mock.ts
│   ├── request-factories.ts
│   └── ollama-responses.ts
├── integration/            # 集成测试
│   └── middleware/
├── unit/                   # 单元测试
│   ├── services/
│   └── transformers/
└── setup.ts                # 测试环境配置
```
