/** 信息卡片组件 */

interface CardProps {
  title: string;
  children: JSX.Element;
  color?: 'primary' | 'info' | 'success' | 'warning' | 'error';
}

const borderClassMap = {
  primary: 'border-primary',
  info: 'border-info',
  success: 'border-success',
  warning: 'border-warning',
  error: 'border-error',
} as const;

/**
 * 渲染 DaisyUI 卡片容器
 * 标题栏左侧可选带颜色强调条
 */
export function Card(props: CardProps): JSX.Element {
  const { title, children, color = 'primary' } = props;
  const borderClass = `border-l-4 ${borderClassMap[color]}`;

  return (
    <div class={`card bg-base-100 shadow-sm ${borderClass}`}>
      <div class="card-body">
        <h2 class="card-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
