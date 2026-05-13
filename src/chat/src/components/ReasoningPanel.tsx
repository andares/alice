import { createSignal, Show, createEffect } from 'solid-js';
import { Brain, Sparkles } from 'lucide-solid';

export interface ReasoningPanelProps {
  content: string;
  isStreaming: boolean;
}

export default function ReasoningPanel(props: ReasoningPanelProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  createEffect(() => {
    setIsOpen(props.isStreaming);
  });

  return (
    <div class="collapse collapse-arrow bg-base-200/50 border border-base-300 rounded-lg my-2">
      <input
        type="checkbox"
        checked={isOpen()}
        onChange={(e) => setIsOpen(e.currentTarget.checked)}
      />
      <div class="collapse-title flex items-center gap-2 text-sm font-medium py-2 min-h-0">
        <Brain size={16} class="text-primary" />
        <span>Thinking Process</span>
        <Sparkles size={14} class="text-secondary" />
        <Show when={props.isStreaming}>
          <span class="loading loading-dots loading-xs ml-auto" />
        </Show>
      </div>
      <div class="collapse-content">
        <div class="max-h-60 overflow-y-auto">
          <pre class="font-mono text-sm whitespace-pre-wrap text-base-content/80">
            {props.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
