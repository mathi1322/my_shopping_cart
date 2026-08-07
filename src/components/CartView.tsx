import { useEffect, useState } from 'preact/hooks';
import { placeholderTile } from '../lib/ui/placeholderTile';

interface CartItem {
  productId: string;
  productName: string;
  vendorId: string;
  unitPriceInCents: number;
  quantity: number;
  subtotalInCents: number;
}

interface CartData {
  id: string;
  items: CartItem[];
  totalInCents: number;
  currency: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export default function CartView() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  async function loadCart() {
    const res = await fetch('/api/cart');
    const data = await res.json();
    setCart(data);
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function updateQuantity(productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setError(null);
    setPendingProductId(productId);
    try {
      const res = await fetch(`/api/cart/items/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not update quantity');
        return;
      }
      setCart(data);
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } finally {
      setPendingProductId(null);
    }
  }

  async function removeItem(productId: string) {
    setError(null);
    setPendingProductId(productId);
    try {
      const res = await fetch(`/api/cart/items/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not remove item');
        return;
      }
      setCart(data);
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } finally {
      setPendingProductId(null);
    }
  }

  if (!cart) {
    return <p class="text-slate-500">Loading your cart…</p>;
  }

  if (cart.items.length === 0) {
    return (
      <div class="rounded bg-white p-10 text-center shadow-sm">
        <p class="text-lg font-medium text-slate-700">Your cart is empty</p>
        <a
          href="/"
          class="mt-3 inline-block rounded-sm bg-[#2874f0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1f5bc4]"
        >
          Shop now
        </a>
      </div>
    );
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      {error && (
        <p class="rounded bg-red-50 px-4 py-2 text-sm text-red-700 lg:col-span-3">{error}</p>
      )}

      <div class="rounded bg-white shadow-sm lg:col-span-2">
        <p class="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-500 uppercase">
          My Cart ({itemCount})
        </p>
        <ul class="divide-y divide-slate-100">
          {cart.items.map((item) => {
            const tile = placeholderTile(item.productName);
            const isPending = pendingProductId === item.productId;
            return (
              <li key={item.productId} class="flex gap-4 p-4">
                <div
                  class="flex h-16 w-16 shrink-0 items-center justify-center rounded text-xl font-bold text-slate-500/70 sm:h-20 sm:w-20"
                  style={{ background: tile.background }}
                >
                  {tile.glyph}
                </div>

                <div class="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <p class="truncate font-medium text-slate-800">{item.productName}</p>
                    <p class="text-xs text-slate-400">Seller: {item.vendorId}</p>
                    <p class="mt-1 text-base font-bold text-slate-900">
                      {formatMoney(item.unitPriceInCents, cart.currency)}
                    </p>
                  </div>

                  <div class="mt-2 flex flex-wrap items-center gap-4">
                    <div class="flex items-center rounded-sm border border-slate-300">
                      <button
                        type="button"
                        aria-label={`Decrease quantity for ${item.productName}`}
                        disabled={isPending || item.quantity <= 1}
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        class="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span class="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity for ${item.productName}`}
                        disabled={isPending}
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        class="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      disabled={isPending}
                      class="text-sm font-semibold text-slate-500 uppercase hover:text-[#2874f0] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <p class="shrink-0 text-right font-bold text-slate-900">
                  {formatMoney(item.subtotalInCents, cart.currency)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div class="sticky top-20 rounded bg-white p-4 shadow-sm">
        <p class="border-b border-slate-100 pb-3 text-sm font-medium text-slate-500 uppercase">
          Price Details
        </p>
        <div class="flex justify-between py-3 text-sm text-slate-600">
          <span>
            Price ({itemCount} item{itemCount === 1 ? '' : 's'})
          </span>
          <span>{formatMoney(cart.totalInCents, cart.currency)}</span>
        </div>
        <div class="flex justify-between border-b border-dashed border-slate-200 pb-3 text-sm text-slate-600">
          <span>Delivery Charges</span>
          <span class="font-medium text-green-600">Free</span>
        </div>
        <div class="flex justify-between py-3 text-base font-bold text-slate-900">
          <span>Total Amount</span>
          <span>{formatMoney(cart.totalInCents, cart.currency)}</span>
        </div>
        <button
          type="button"
          disabled
          title="Checkout is out of scope for this demo — see ARCHITECTURE.md"
          class="mt-2 w-full cursor-not-allowed rounded-sm bg-[#fb641b] px-4 py-3 text-sm font-bold tracking-wide text-white uppercase opacity-60"
        >
          Place Order
        </button>
        <p class="mt-2 text-center text-xs text-slate-400">
          Checkout isn't implemented in this demo.
        </p>
      </div>
    </div>
  );
}
