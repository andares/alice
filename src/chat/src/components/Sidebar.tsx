import { createSignal, For, Show, onMount } from 'solid-js';
import { store, loadConversations, createConversation, selectConversation } from '~/stores/chatStore';
import { deleteConversation, updateTitle } from '~/api/chat';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Pencil,
  Settings,
  PanelLeft,
  PanelLeftClose,
  MoreVertical,
} from 'lucide-solid';

export interface SidebarProps {
  onToggle?: (open: boolean) => void;
  onOpenSettings?: () => void;
}

/** 将时间戳格式化为相对时间 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/**
 * 会话侧边栏组件
 *
 * 功能：
 * - Logo + 标题
 * - 新建会话
 * - 搜索过滤
 * - 会话列表（按 updated_at 倒序）
 * - Hover 操作：重命名、删除（DaisyUI dropdown）
 * - 当前会话高亮
 * - 可折叠，通知父组件
 */
export default function Sidebar(props: SidebarProps) {
  const [isOpen, setIsOpen] = createSignal(true);
  const [search, setSearch] = createSignal('');
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editingTitle, setEditingTitle] = createSignal('');

  onMount(() => {
    loadConversations();
  });

  /** 切换侧边栏展开/收起 */
  const toggleSidebar = () => {
    const next = !isOpen();
    setIsOpen(next);
    props.onToggle?.(next);
  };

  /** 过滤并排序后的会话列表 */
  const filteredConversations = () => {
    const s = search().toLowerCase();
    return store.conversations
      .filter((c) => c.title.toLowerCase().includes(s))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  };

  /** 新建会话 */
  const handleNewChat = () => {
    createConversation();
  };

  /** 选择会话 */
  const handleSelect = (id: string) => {
    selectConversation(id);
  };

  /** 进入重命名状态 */
  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditingTitle(title);
  };

  /** 保存重命名 */
  const saveRename = async () => {
    const id = editingId();
    if (!id) return;
    const title = editingTitle().trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    try {
      await updateTitle(id, title);
      await loadConversations();
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    } finally {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  /** 取消重命名 */
  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  /** 删除会话 */
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await deleteConversation(id);
      await loadConversations();
      if (store.currentConversationId === id) {
        createConversation();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  return (
    <aside
      class="bg-base-200 flex flex-col border-r border-base-300 transition-all duration-200 h-full"
      classList={{
        'w-64': isOpen(),
        'w-0 overflow-hidden': !isOpen(),
      }}
    >
      {/* 顶部：Logo + 标题 + 折叠按钮 */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
        <div class="flex items-center gap-2 overflow-hidden">
          <MessageSquare size={20} class="text-primary shrink-0" />
          <Show when={isOpen()}>
            <span class="text-lg font-semibold truncate">Alice Chat</span>
          </Show>
        </div>
        <button
          class="btn btn-ghost btn-sm btn-square shrink-0"
          onClick={toggleSidebar}
          title={isOpen() ? 'Close sidebar' : 'Open sidebar'}
        >
          <Show when={isOpen()} fallback={<PanelLeft size={18} />}>
            <PanelLeftClose size={18} />
          </Show>
        </button>
      </div>

      {/* 新建会话 + 搜索 */}
      <div class="px-3 pt-3 pb-2 shrink-0 space-y-2">
        <button class="btn btn-ghost btn-sm w-full justify-start gap-2" onClick={handleNewChat}>
          <Plus size={16} />
          <Show when={isOpen()}>
            <span>New Chat</span>
          </Show>
        </button>
        <Show when={isOpen()}>
          <div class="relative">
            <Search
              size={14}
              class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
            />
            <input
              type="text"
              class="input input-sm input-bordered w-full pl-9"
              placeholder="Search conversations…"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
            />
          </div>
        </Show>
      </div>

      {/* 会话列表 */}
      <div class="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <Show
          when={filteredConversations().length > 0}
          fallback={
            <div class="px-3 py-2 rounded-lg text-sm text-base-content/40">
              No conversations yet
            </div>
          }
        >
          <ul class="menu menu-sm p-0 gap-1">
            <For each={filteredConversations()}>
              {(c) => (
                <li class="group relative">
                  <Show
                    when={editingId() === c.id}
                    fallback={
                      <button
                        class="w-full text-left rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2"
                        classList={{
                          'bg-primary/10 text-primary': c.id === store.currentConversationId,
                          'hover:bg-base-300': c.id !== store.currentConversationId,
                        }}
                        onClick={() => handleSelect(c.id)}
                      >
                        <span class="truncate flex-1">{c.title}</span>
                        <span class="text-xs text-base-content/40 shrink-0">
                          {formatRelativeTime(c.updated_at)}
                        </span>
                      </button>
                    }
                  >
                    <input
                      class="input input-sm input-bordered w-full"
                      value={editingTitle()}
                      onInput={(e) => setEditingTitle(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveRename();
                        }
                        if (e.key === 'Escape') {
                          cancelRename();
                        }
                      }}
                      onBlur={saveRename}
                      ref={(el) => {
                        if (el) {
                          el.focus();
                          el.select();
                        }
                      }}
                    />
                  </Show>

                  {/* Hover 操作菜单（DaisyUI dropdown） */}
                  <Show when={editingId() !== c.id}>
                    <div class="dropdown dropdown-end absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:block">
                      <div
                        tabindex="0"
                        role="button"
                        class="btn btn-ghost btn-xs btn-square"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical size={14} />
                      </div>
                      <ul
                        tabindex="0"
                        class="dropdown-content menu bg-base-100 rounded-box z-[1] w-32 p-2 shadow"
                      >
                        <li>
                          <a
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(c.id, c.title);
                            }}
                          >
                            <Pencil size={14} /> Rename
                          </a>
                        </li>
                        <li>
                          <a
                            class="text-error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(c.id);
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </a>
                        </li>
                      </ul>
                    </div>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      {/* 底部：设置 + 版本号 */}
      <div class="p-3 border-t border-base-300 shrink-0">
        <button
          class="btn btn-ghost btn-sm w-full justify-start gap-2 mb-2"
          onClick={props.onOpenSettings}
        >
          <Settings size={16} />
          <Show when={isOpen()}>
            <span>Settings</span>
          </Show>
        </button>
        <Show when={isOpen()}>
          <div class="text-xs text-base-content/40 px-2">Alice Chat v1.0</div>
        </Show>
      </div>
    </aside>
  );
}
