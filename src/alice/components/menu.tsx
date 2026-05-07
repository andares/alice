/** 侧边栏菜单组件 */

interface MenuItem {
  label: string;
  href: string;
  icon?: string;  // DaisyUI icon class or emoji
}

interface MenuProps {
  items: MenuItem[];
  active: string;  // active item label
}

/**
 * 渲染垂直导航菜单
 * 使用 DaisyUI menu 组件，活动项高亮显示
 */
export function Menu(props: MenuProps): JSX.Element {
  const { items, active } = props;

  return (
    <ul class="menu bg-base-200 rounded-box w-56 gap-2">
      {items.map((item) => {
        const isActive = item.label.toLowerCase() === active.toLowerCase();
        const activeClass = isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300';
        return (
          <li>
            <a
              href={item.href}
              class={activeClass}
            >
              {item.icon ? <span class="mr-2">{item.icon}</span> : null}
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
