import { useEffect, useState } from 'preact/hooks';
import type { AuthUser } from './LoginForm';

interface Props {
  initialLoggedIn: boolean;
}

export default function CartBadge({ initialLoggedIn }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);

  async function refresh(isLoggedIn: boolean) {
    if (!isLoggedIn) {
      setCount(null);
      return;
    }
    try {
      const res = await fetch('/api/cart');
      if (!res.ok) {
        setCount(null);
        return;
      }
      const data = await res.json();
      const itemCount = data.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0,
      );
      setCount(itemCount);
    } catch {
      setCount(null);
    }
  }

  useEffect(() => {
    refresh(loggedIn);
    const cartHandler = () => refresh(loggedIn);
    window.addEventListener('cart:updated', cartHandler);
    function authHandler(event: Event) {
      const detail = (event as CustomEvent<{ user: AuthUser | null }>).detail;
      const isLoggedIn = !!detail?.user;
      setLoggedIn(isLoggedIn);
      refresh(isLoggedIn);
    }
    window.addEventListener('auth:changed', authHandler);
    return () => {
      window.removeEventListener('cart:updated', cartHandler);
      window.removeEventListener('auth:changed', authHandler);
    };
  }, [loggedIn]);

  function handleClick(event: MouseEvent) {
    if (!loggedIn) {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent('auth:login-required', {
          detail: {
            onSuccess: () => {
              window.location.href = '/cart';
            },
          },
        }),
      );
    }
  }

  return (
    <a
      href="/cart"
      onClick={handleClick}
      class="inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="h-5 w-5"
      >
        <path d="M7 4a1 1 0 0 0-1 1v1H4.5a.75.75 0 0 0 0 1.5h.69l1.62 9.72A2 2 0 0 0 8.78 19H17a.75.75 0 0 0 0-1.5H8.78a.5.5 0 0 1-.49-.42L8.1 16h9.02a2 2 0 0 0 1.93-1.48l1.4-5.14A1 1 0 0 0 19.5 8H7.36l-.2-1.2A1 1 0 0 0 6.17 6H7V5a1 1 0 0 0-1-1Z"></path>
      </svg>
      <span class="hidden sm:inline">Cart</span>
      {count !== null && count > 0 && (
        <span class="bg-accent inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-slate-900">
          {count}
        </span>
      )}
    </a>
  );
}
