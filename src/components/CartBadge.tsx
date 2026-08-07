import { useEffect, useState } from 'preact/hooks';

export default function CartBadge() {
  const [count, setCount] = useState<number | null>(null);

  async function refresh() {
    try {
      const res = await fetch('/api/cart');
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
    refresh();
    const handler = () => refresh();
    window.addEventListener('cart:updated', handler);
    return () => window.removeEventListener('cart:updated', handler);
  }, []);

  return (
    <a
      href="/cart"
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
        <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffe11b] px-1.5 text-xs font-bold text-slate-900">
          {count}
        </span>
      )}
    </a>
  );
}
