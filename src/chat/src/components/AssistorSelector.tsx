import { createSignal, For, onMount } from 'solid-js';
import { getAssistors } from '~/api/chat';
import type { Assistor } from '~/api/chat';

export interface AssistorSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export default function AssistorSelector(props: AssistorSelectorProps) {
  const [assistors, setAssistors] = createSignal<Assistor[]>([]);

  onMount(async () => {
    try {
      const list = await getAssistors();
      setAssistors(list);
    } catch (err) {
      console.error('Failed to load assistors:', err);
    }
  });

  return (
    <select
      class="select select-sm select-bordered shrink-0"
      value={props.value ?? ''}
      onChange={(e) => {
        const val = e.currentTarget.value;
        props.onChange(val || null);
      }}
      disabled={props.disabled}
    >
      <option value="">Default</option>
      <For each={assistors()}>
        {(a) => <option value={String(a.id)}>{a.name}</option>}
      </For>
    </select>
  );
}
