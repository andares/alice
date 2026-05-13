import { createSignal, createResource, Show, onMount, onCleanup } from 'solid-js';
import { createHighlighter, type Highlighter } from 'shiki';
import { Copy, Check } from 'lucide-solid';

function normalizeLang(lang?: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    yml: 'yaml',
  };
  return map[lang || ''] || lang || 'text';
}

function getCurrentShikiTheme(): 'github-light' | 'github-dark' {
  if (typeof document === 'undefined') return 'github-light';

  const theme = document.documentElement.getAttribute('data-theme');
  const darkThemes = new Set([
    'dark', 'black', 'dracula', 'night', 'forest', 'luxury',
    'business', 'coffee', 'dim', 'sunset', 'synthwave',
    'halloween', 'aqua',
  ]);

  if (theme) {
    if (darkThemes.has(theme)) return 'github-dark';
    return 'github-light';
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'github-dark';
  }
  return 'github-light';
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'typescript', 'tsx', 'javascript', 'jsx',
        'python', 'bash', 'json', 'html', 'css',
        'sql', 'yaml', 'rust', 'go', 'java',
      ],
    });
  }
  return highlighterPromise;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export default function CodeBlock(props: CodeBlockProps) {
  const [copied, setCopied] = createSignal(false);
  const [theme, setTheme] = createSignal<'github-light' | 'github-dark'>(
    getCurrentShikiTheme()
  );

  onMount(() => {
    const observer = new MutationObserver(() => {
      setTheme(getCurrentShikiTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setTheme(getCurrentShikiTheme());
    mq.addEventListener('change', handler);

    onCleanup(() => {
      observer.disconnect();
      mq.removeEventListener('change', handler);
    });
  });

  const [highlighted] = createResource(
    () => ({
      code: props.code,
      lang: normalizeLang(props.lang),
      theme: theme(),
    }),
    async ({ code, lang, theme }) => {
      const highlighter = await getHighlighter();
      return highlighter.codeToHtml(code, { lang, theme });
    }
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div class="relative group not-prose">
      <div class="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <span class="text-xs font-mono opacity-70 bg-base-300/80 px-2 py-1 rounded">
          {props.lang || 'text'}
        </span>
        <button
          class="btn btn-ghost btn-xs gap-1 bg-base-300/80 hover:bg-base-300"
          onClick={handleCopy}
          title="Copy code"
        >
          <Show when={copied()} fallback={<Copy size={14} />}>
            <Check size={14} class="text-success" />
          </Show>
          <span>{copied() ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      <div class="mockup-code overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:before:hidden">
        <Show
          when={!highlighted.loading}
          fallback={
            <pre class="px-4">
              <code>{props.code}</code>
            </pre>
          }
        >
          <div innerHTML={highlighted()} />
        </Show>
      </div>
    </div>
  );
}
