import { useEffect, useState } from 'preact/hooks';
import type { AuthUser } from './LoginForm';

interface Props {
  productId: string;
  stockQuantity: number;
  initialLoggedIn: boolean;
}

export default function AddToCartControl({ productId, stockQuantity, initialLoggedIn }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ user: AuthUser | null }>).detail;
      setLoggedIn(!!detail?.user);
    }
    window.addEventListener('auth:changed', handler);
    return () => window.removeEventListener('auth:changed', handler);
  }, []);

  const outOfStock = stockQuantity <= 0;

  function clamp(value: number): number {
    return Math.max(1, Math.min(stockQuantity, value));
  }

  async function performAddToCart() {
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error?.message ?? 'Could not add to cart');
        return;
      }
      setStatus('success');
      setMessage('Added ✓');
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch {
      setStatus('error');
      setMessage('Network error');
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (!loggedIn) {
      window.dispatchEvent(
        new CustomEvent('auth:login-required', { detail: { onSuccess: () => performAddToCart() } }),
      );
      return;
    }
    performAddToCart();
  }

  if (outOfStock) {
    return (
      <button
        type="button"
        disabled
        class="w-full cursor-not-allowed rounded-sm bg-slate-200 px-3 py-2 text-xs font-bold tracking-wide text-slate-400 uppercase sm:text-sm"
      >
        Out of stock
      </button>
    );
  }

  return (
    <form class="flex flex-col gap-2" onSubmit={handleSubmit}>
      <div class="flex items-center gap-2">
        <div class="flex items-center rounded-sm border border-slate-300">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => clamp(q - 1))}
            class="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            disabled={quantity <= 1}
          >
            −
          </button>
          <span class="w-8 text-center text-sm font-medium">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => clamp(q + 1))}
            class="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            disabled={quantity >= stockQuantity}
          >
            +
          </button>
        </div>
        {message && (
          <span
            class={`text-xs font-medium ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}
          >
            {message}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        class="bg-brand hover:bg-brand-dark w-full rounded-full px-3 py-2 text-xs font-bold tracking-wide text-white uppercase shadow-sm disabled:opacity-60 sm:text-sm"
      >
        {status === 'loading' ? 'Adding…' : 'Add to cart'}
      </button>
    </form>
  );
}
