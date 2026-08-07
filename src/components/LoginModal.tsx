import { useEffect, useRef, useState } from 'preact/hooks';
import LoginForm, { type AuthUser } from './LoginForm';

interface LoginRequiredDetail {
  onSuccess?: (user: AuthUser) => void;
}

/**
 * Mounted once in Layout.astro. Any island can request a login by dispatching
 * `auth:login-required` on window — this is the only cross-island way to pop
 * the modal, matching the existing `cart:updated` custom-event convention.
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const pendingOnSuccess = useRef<((user: AuthUser) => void) | null>(null);

  useEffect(() => {
    function handleLoginRequired(event: Event) {
      const detail = (event as CustomEvent<LoginRequiredDetail>).detail ?? {};
      pendingOnSuccess.current = detail.onSuccess ?? null;
      setOpen(true);
    }
    window.addEventListener('auth:login-required', handleLoginRequired);
    return () => window.removeEventListener('auth:login-required', handleLoginRequired);
  }, []);

  function close() {
    setOpen(false);
    pendingOnSuccess.current = null;
  }

  function handleSuccess(user: AuthUser) {
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user } }));
    const callback = pendingOnSuccess.current;
    pendingOnSuccess.current = null;
    setOpen(false);
    callback?.(user);
  }

  if (!open) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={close}
    >
      <div class="relative w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          class="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-md hover:text-slate-800"
        >
          ✕
        </button>
        <LoginForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
