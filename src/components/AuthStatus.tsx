import { useEffect, useRef, useState } from 'preact/hooks';
import type { AuthUser } from './LoginForm';
import { placeholderTile } from '../lib/ui/placeholderTile';

interface Props {
  initialUser: AuthUser | null;
}

export default function AuthStatus({ initialUser }: Props) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [open, setOpen] = useState(false);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleAuthChanged(event: Event) {
      const detail = (event as CustomEvent<{ user: AuthUser | null }>).detail;
      setUser(detail?.user ?? null);
      setOpen(false);
    }
    window.addEventListener('auth:changed', handleAuthChanged);
    return () => window.removeEventListener('auth:changed', handleAuthChanged);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'seller') {
      setPendingOrderCount(0);
      return;
    }
    async function loadPendingOrderCount() {
      try {
        const res = await fetch('/api/orders/received');
        if (!res.ok) return;
        const data = await res.json();
        const placed = (data.orders as Array<{ status: string }>).filter(
          (order) => order.status === 'placed',
        );
        setPendingOrderCount(placed.length);
      } catch {
        setPendingOrderCount(0);
      }
    }
    loadPendingOrderCount();
    window.addEventListener('orders:updated', loadPendingOrderCount);
    return () => window.removeEventListener('orders:updated', loadPendingOrderCount);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  if (!user) {
    return (
      <a
        href="/login"
        class="rounded-full px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
      >
        Login
      </a>
    );
  }

  const tile = placeholderTile(user.email);
  const isSeller = user.role === 'seller';

  return (
    <div class="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        class="flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1 hover:bg-white/10"
      >
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-slate-700"
          style={{ background: tile.background }}
        >
          {tile.glyph}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class={`h-4 w-4 text-white transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div class="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-blue-200 bg-white py-1 shadow-lg">
          <div class="border-b border-slate-100 px-4 py-3">
            <p class="truncate text-sm font-semibold text-slate-800">{user.email}</p>
            <p class="text-xs text-slate-400 capitalize">{user.role} account</p>
          </div>
          {isSeller && (
            <a
              href="/sell/dashboard"
              class="text-brand block px-4 py-2 text-sm font-medium hover:bg-blue-50"
            >
              Dashboard
            </a>
          )}
          <a href="/profile" class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50">
            My Profile
          </a>
          <a href="/orders" class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50">
            My Orders
          </a>
          {isSeller && (
            <>
              <a href="/sell" class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50">
                My Products
              </a>
              <a
                href={`/?vendorId=${user.id}`}
                class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50"
              >
                My Store
              </a>
              <a
                href="/sell/orders"
                class="flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-blue-50"
              >
                Orders Received
                {pendingOrderCount > 0 && (
                  <span class="bg-accent inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-slate-900">
                    {pendingOrderCount}
                  </span>
                )}
              </a>
            </>
          )}
          <a href="/cart" class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50">
            My Cart
          </a>
          <div class="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={handleLogout}
            class="block w-full px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
