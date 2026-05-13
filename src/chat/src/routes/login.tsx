import { createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
  Bot,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  ShieldAlert,
  Sparkles,
  User,
  WifiOff,
} from 'lucide-solid';
import { login, checkSession } from '~/api/chat';

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [errorType, setErrorType] = createSignal<
    'disabled' | 'password' | 'network' | ''
  >('');
  const [showPassword, setShowPassword] = createSignal(false);
  const [isTransitioning, setIsTransitioning] = createSignal(false);
  const [checkingSession, setCheckingSession] = createSignal(true);

  onMount(() => {
    const autoRedirect = async () => {
      const hasCookie = document.cookie
        .split(';')
        .some(c => c.trim().startsWith('auth_token='));

      if (hasCookie) {
        const valid = await checkSession();
        if (valid) {
          navigate('/');
          return;
        }
      }

      setCheckingSession(false);
    };

    autoRedirect();
  });

  const classifyError = (msg: string) => {
    const lowered = msg.toLowerCase();
    if (lowered.includes('disabled') || lowered.includes('chat is disabled')) {
      setErrorType('disabled');
    } else if (
      lowered.includes('incorrect') ||
      lowered.includes('wrong') ||
      lowered.includes('password')
    ) {
      setErrorType('password');
    } else if (lowered.includes('network') || lowered.includes('fetch')) {
      setErrorType('network');
    } else {
      setErrorType('password');
    }
    setError(msg);
  };

  const errorAlertConfig = () => {
    switch (errorType()) {
      case 'disabled':
        return {
          alertClass: 'alert-warning alert-soft',
          icon: <ShieldAlert size={18} />,
        };
      case 'network':
        return {
          alertClass: 'alert-error alert-soft',
          icon: <WifiOff size={18} />,
        };
      case 'password':
      default:
        return {
          alertClass: 'alert-error alert-soft',
          icon: <KeyRound size={18} />,
        };
    }
  };

  const handleSubmit = async (e?: Event) => {
    e?.preventDefault();
    if (!username().trim() || !password().trim()) return;

    setLoading(true);
    setError('');
    setErrorType('');

    try {
      const result = await login(username(), password());

      if (result.ok) {
        setIsTransitioning(true);
        setTimeout(() => {
          navigate('/');
        }, 600);
      } else {
        classifyError(result.error || 'Invalid credentials');
      }
    } catch {
      classifyError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (checkingSession()) {
    return (
      <div class="flex h-screen items-center justify-center bg-base-200 p-4">
        <div class="card bg-base-100 shadow-2xl max-w-2xl w-full overflow-hidden">
          <div class="card-body flex flex-row max-sm:flex-col max-sm:card-compact">
            <div class="flex-1 bg-gradient-to-br from-primary to-primary-focus text-primary-content flex flex-col items-center justify-center gap-6 p-10 animate-pulse">
              <div class="w-16 h-16 rounded-2xl bg-primary-content/20" />
              <div class="h-8 w-48 bg-primary-content/20 rounded" />
              <div class="h-4 w-32 bg-primary-content/20 rounded" />
            </div>
            <div class="flex-1 flex flex-col justify-center gap-5 p-10">
              <div class="skeleton h-6 w-40" />
              <div class="skeleton h-4 w-56" />
              <div class="skeleton h-12 w-full mt-2" />
              <div class="skeleton h-12 w-full mt-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="flex h-screen items-center justify-center bg-base-200 p-4">
      <div
        class="card lg:card-side bg-base-100 shadow-2xl max-w-2xl w-full overflow-hidden transition-all duration-500"
        classList={{
          'opacity-0 scale-95 translate-y-2': isTransitioning(),
          'opacity-100 scale-100 translate-y-0': !isTransitioning(),
        }}
      >
        <div class="card-body bg-gradient-to-br from-primary to-primary-focus text-primary-content lg:w-80 items-center justify-center gap-6 p-10 max-sm:card-compact max-sm:flex-col">
          <div class="relative">
            <div class="w-20 h-20 rounded-2xl bg-primary-content/20 flex items-center justify-center animate-pulse">
              <Bot size={40} />
            </div>
            <div class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-content/30 flex items-center justify-center">
              <Sparkles size={16} class="animate-pulse" />
            </div>
          </div>

          <div class="text-center">
            <h1 class="text-4xl font-bold tracking-tight">Alice Chat</h1>
            <p class="text-primary-content/70 mt-2 text-lg">
              Your AI companion
            </p>
          </div>

          <p class="text-primary-content/50 text-sm text-center leading-relaxed max-w-xs">
            Secure, fast, and intelligent conversations powered by local LLMs.
          </p>
        </div>

        <div class="card-body justify-center gap-5 p-10 min-w-80 max-sm:card-compact">
          <div>
            <h2 class="text-2xl font-semibold flex items-center gap-2">
              <Lock size={22} class="text-primary" />
              Welcome back
            </h2>
            <p class="text-base-content/50 text-sm mt-2">
              Enter your username and password to access your conversations
            </p>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            {error() && (
              <div class={`alert ${errorAlertConfig().alertClass}`}>
                {errorAlertConfig().icon}
                <span>{error()}</span>
              </div>
            )}

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">Username</span>
              </div>
              <label class="input input-bordered flex items-center gap-2 pr-2">
                <User size={18} class="text-base-content/40 shrink-0" />
                <input
                  type="text"
                  placeholder="Enter your username"
                  class="grow bg-transparent outline-none"
                  value={username()}
                  onInput={e => setUsername(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading() || isTransitioning()}
                />
              </label>
            </label>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-medium">Password</span>
              </div>
              <label class="input input-bordered flex items-center gap-2 pr-2">
                <KeyRound size={18} class="text-base-content/40 shrink-0" />
                <input
                  type={showPassword() ? 'text' : 'password'}
                  placeholder="••••••••"
                  class="grow bg-transparent outline-none"
                  value={password()}
                  onInput={e => setPassword(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading() || isTransitioning()}
                />
                <button
                  type="button"
                  class="btn btn-ghost btn-square btn-xs shrink-0"
                  onClick={() => setShowPassword(p => !p)}
                  title={showPassword() ? 'Hide password' : 'Show password'}
                  disabled={loading() || isTransitioning()}
                >
                  {showPassword() ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </label>
            </label>

            <button
              type="submit"
              class="btn btn-primary mt-2"
              disabled={
                loading() || !username().trim() || !password().trim() || isTransitioning()
              }
            >
              {loading() || isTransitioning() ? (
                <>
                  <span class="loading loading-spinner loading-sm" />
                  {isTransitioning() ? 'Redirecting…' : 'Signing in…'}
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
