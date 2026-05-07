/** 标签字段展示组件 */

interface FieldProps {
  label: string;
  value: string;
  multiline?: boolean;
}

/**
 * 渲染带标签的字段值
 * 短值用 readonly input，多行值用 readonly textarea
 */
export function Field(props: FieldProps): JSX.Element {
  const { label, value, multiline } = props;

  return (
    <div class="form-control w-full">
      <label class="label">
        <span class="label-text text-sm opacity-70">{label}</span>
      </label>
      {multiline ? (
        <textarea
          class="textarea textarea-bordered font-mono w-full"
          readonly
          rows={String(Math.min(10, Math.max(3, value.split('\n').length)))}
        >
          {value}
        </textarea>
      ) : (
        <input
          type="text"
          class="input input-bordered w-full font-mono"
          value={value}
          readonly
        />
      )}
    </div>
  );
}
