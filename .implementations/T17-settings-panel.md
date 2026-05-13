# T17 - 模型选择器与设置面板

## 目标
创建 `SettingsPanel.tsx` 设置面板（modal），并增强 `ChatArea.tsx` 模型选择器的显示。

## 变更文件

### 新建
- `src/chat/src/components/SettingsPanel.tsx` — DaisyUI modal 设置面板

### 修改
- `src/chat/src/components/ChatArea.tsx` — 增强模型 option 显示（名称+大小），添加设置按钮
- `src/chat/src/components/Sidebar.tsx` — Settings 按钮接入 onOpenSettings
- `src/chat/src/routes/index.tsx` — 提升 settingsOpen 状态，统一渲染 SettingsPanel

## SettingsPanel 功能
1. **Theme**: light/dark/system 三选一（`join` 按钮组），设置 `data-theme`，存 localStorage
2. **Stream responses**: toggle，存 localStorage (`alice-stream`)
3. **Show thinking process**: toggle，存 localStorage (`alice-thinking`)
4. **Clear all conversations**: 红色按钮，confirm 后逐个 `deleteConversation` + `loadConversations`
5. **About**: Alice Chat v1.0 + GitHub 链接

## 模型选择器增强
- `formatSize` 函数：≥1GB 显示 GB，<1GB 显示 MB
- option 格式：`{name} ({size})`

## 状态管理
- `settingsOpen` 提升到 `index.tsx`，同时传递给 Sidebar 和 ChatArea
- SettingsPanel 始终挂载（保证主题监听持久），通过 `modal-open` 类控制显隐

## 依赖
- `lucide-solid`: Settings, Sun, Moon, Monitor, Trash2, Info, X
- DaisyUI 5: modal, toggle, join, divider, btn, btn-error

## 注意事项
- 不修改 stores/chatStore.ts 或 api/chat.ts
- 不删除 ChatArea 已有的模型选择器结构，仅增强 option 显示
- DaisyUI 5 使用 `join` 替代 `btn-group`
