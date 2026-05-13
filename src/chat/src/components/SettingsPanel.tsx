import { createSignal, onMount, onCleanup } from 'solid-js';
import { Settings, Sun, Moon, Monitor, Trash2, Info, X } from 'lucide-solid';
import { loadConversations } from '~/stores/chatStore';
import { deleteConversation, getConversations } from '~/api/chat';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const [theme, setTheme] = createSignal('light');
  const [streamEnabled, setStreamEnabled] = createSignal(true);
  const [showThinking, setShowThinking] = createSignal(false);

  const applyTheme = (t: string) => {
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  };

  onMount(() => {
    const savedTheme = localStorage.getItem('alice-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const savedStream = localStorage.getItem('alice-stream');
    setStreamEnabled(savedStream !== 'false');

    const savedThinking = localStorage.getItem('alice-thinking');
    setShowThinking(savedThinking === 'true');

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme() === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    onCleanup(() => mediaQuery.removeEventListener('change', handleChange));
  });

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('alice-theme', newTheme);
  };

  const handleStreamChange = (enabled: boolean) => {
    setStreamEnabled(enabled);
    localStorage.setItem('alice-stream', String(enabled));
  };

  const handleThinkingChange = (enabled: boolean) => {
    setShowThinking(enabled);
    localStorage.setItem('alice-thinking', String(enabled));
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL conversations? This action cannot be undone.')) {
      return;
    }
    try {
      const conversations = await getConversations();
      for (const c of conversations) {
        await deleteConversation(c.id);
      }
      await loadConversations();
    } catch (err) {
      console.error('Failed to clear conversations:', err);
    }
  };

  return (
    <div
      class="modal"
      classList={{ 'modal-open': props.isOpen }}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <div class="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold flex items-center gap-2">
            <Settings size={20} />
            Settings
          </h3>
          <button
            class="btn btn-ghost btn-sm btn-square"
            onClick={props.onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label class="label-text font-medium mb-2 block">Theme</label>
            <div class="join">
              <button
                class="btn btn-sm join-item"
                classList={{ 'btn-active': theme() === 'light' }}
                onClick={() => handleThemeChange('light')}
              >
                <Sun size={14} class="mr-1" />
                Light
              </button>
              <button
                class="btn btn-sm join-item"
                classList={{ 'btn-active': theme() === 'dark' }}
                onClick={() => handleThemeChange('dark')}
              >
                <Moon size={14} class="mr-1" />
                Dark
              </button>
              <button
                class="btn btn-sm join-item"
                classList={{ 'btn-active': theme() === 'system' }}
                onClick={() => handleThemeChange('system')}
              >
                <Monitor size={14} class="mr-1" />
                System
              </button>
            </div>
          </div>

          <div class="divider my-2" />

          <div class="flex items-center justify-between">
            <span class="font-medium">Stream responses</span>
            <input
              type="checkbox"
              class="toggle toggle-primary"
              checked={streamEnabled()}
              onChange={(e) => handleStreamChange(e.currentTarget.checked)}
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="font-medium">Show thinking process</span>
            <input
              type="checkbox"
              class="toggle toggle-primary"
              checked={showThinking()}
              onChange={(e) => handleThinkingChange(e.currentTarget.checked)}
            />
          </div>

          <div class="divider my-2" />

          <div>
            <button class="btn btn-error btn-sm w-full" onClick={handleClearAll}>
              <Trash2 size={14} class="mr-2" />
              Clear all conversations
            </button>
          </div>

          <div class="divider my-2" />

          <div class="text-center text-sm text-base-content/60">
            <div class="flex items-center justify-center gap-1 mb-1">
              <Info size={14} />
              <span>Alice Chat v1.0</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              class="link link-primary"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
