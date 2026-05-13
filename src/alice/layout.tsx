import { Menu } from './components/menu';

/** 页面布局组件 */

interface LayoutProps {
  children: JSX.Element;
  activeMenu: 'status' | 'config' | 'logs' | 'api-keys' | 'router-models' | 'users';
  title: string;
}

const menuItems = [
  { label: 'Status', href: '/alice', icon: '📊' },
  { label: 'Config', href: '/alice/config', icon: '⚙️' },
  { label: 'Logs', href: '/alice/logs', icon: '📝' },
  { label: 'API Keys', href: '/alice/api-keys', icon: '🔑' },
  { label: 'Models', href: '/alice/router-models', icon: '🤖' },
  { label: 'Users', href: '/alice/users', icon: '👥' },
];

/**
 * 渲染完整 HTML 文档布局
 * 左侧边栏导航 + 右侧内容区域
 */
export function Layout(props: LayoutProps): JSX.Element {
  const { children, activeMenu, title } = props;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} | Alice</title>
        <link rel="stylesheet" href="/alice/static/alice.css" />
        <script src="/alice/static/htmx.min.js"></script>
      </head>
      <body class="bg-base-100 text-base-content" hx-boost="true">
        <div class="flex h-screen">
          <aside class="w-64 bg-base-200 flex items-center justify-center shrink-0">
            <Menu items={menuItems} active={activeMenu} />
          </aside>
          <main id="content" class="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
