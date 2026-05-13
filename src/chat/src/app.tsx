import { Router, useNavigate, useLocation } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { createEffect, Suspense, type JSX } from 'solid-js';
import './app.css';

/** 认证守卫：检查 auth_token cookie，未登录重定向到 /login */
function AuthGuard(props: { children: JSX.Element }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 登录页无需检查
  const isLoginPage = () => location.pathname === '/login';

  createEffect(() => {
    // 跳过 SSR 阶段的检查
    if (typeof document === 'undefined') return;
    if (isLoginPage()) return;

    const hasToken = document.cookie.split(';').some(c => c.trim().startsWith('auth_token='));
    if (!hasToken) {
      navigate('/login');
    }
  });

  return <Suspense>{props.children}</Suspense>;
}

export default function App() {
  return (
    <Router root={props => <AuthGuard>{props.children}</AuthGuard>} base="/chat">
      <FileRoutes />
    </Router>
  );
}
