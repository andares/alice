/** JSON 展示文本域组件 */

interface JsonTextareaProps {
  content: string;  // JSON string to display
  label?: string;
}

/**
 * 渲染带格式化的 JSON 展示文本域
 * 尝试美化打印，解析失败时回退到原始字符串
 * 使用深色背景和等宽字体
 */
export function JsonTextarea(props: JsonTextareaProps): JSX.Element {
  const { content, label } = props;

  let formatted: string;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = content;
  }

  const lineCount = formatted.split('\n').length;
  const rows = String(Math.min(30, Math.max(5, lineCount)));

  return (
    <div class="form-control w-full">
      {label ? (
        <label class="label">
          <span class="label-text text-sm opacity-70">{label}</span>
        </label>
      ) : null}
      <textarea
        class="textarea textarea-bordered w-full font-mono text-sm"
        readonly
        rows={rows}
      >
        {formatted}
      </textarea>
    </div>
  );
}
