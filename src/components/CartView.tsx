import { useEffect, useState } from 'preact/hooks';
import { placeholderTile } from '../lib/ui/placeholderTile';
import { fetchJson } from '../lib/ui/fetchJson';

interface CartItem {
  productId: string;
  productName: string;
  productImage: string | null;
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

interface Props {
  initialAddress: string;
  initialPhone: string;
}

type CheckoutStep = 'closed' | 'address' | 'confirm';

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

export default function CartView({ initialAddress, initialPhone }: Props) {
  const [cart, setCart] = useState<CartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('closed');
  const [deliveryAddress, setDeliveryAddress] = useState(initialAddress);
  const [deliveryPhone, setDeliveryPhone] = useState(initialPhone);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadCart() {
    const result = await fetchJson<CartData>('/api/cart');
    if (!result.ok) {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setCart(result.data);
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function updateQuantity(productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setError(null);
    setPendingProductId(productId);
    try {
      const result = await fetchJson<CartData>(`/api/cart/items/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCart(result.data);
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } finally {
      setPendingProductId(null);
    }
  }

  async function removeItem(productId: string) {
    setError(null);
    setPendingProductId(productId);
    try {
      const result = await fetchJson<CartData>(`/api/cart/items/${productId}`, {
        method: 'DELETE',
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCart(result.data);
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } finally {
      setPendingProductId(null);
    }
  }

  function openCheckout() {
    setCheckoutError(null);
    setCheckoutStep('address');
  }

  function closeCheckout() {
    setCheckoutStep('closed');
  }

  function continueToConfirm(event: Event) {
    event.preventDefault();
    if (!deliveryAddress.trim() || !deliveryPhone.trim()) return;
    setCheckoutStep('confirm');
  }

  async function placeOrder() {
    setPlacing(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryAddress, deliveryPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error?.message ?? 'Could not place your order');
        // A 409 may mean prices were refreshed server-side — reload so the buyer sees the new total.
        if (res.status === 409) await loadCart();
        return;
      }
      window.dispatchEvent(new CustomEvent('cart:updated'));
      window.dispatchEvent(new CustomEvent('orders:updated'));
      window.location.href = '/orders?placed=1';
    } catch {
      setCheckoutError('Network error — please try again');
    } finally {
      setPlacing(false);
    }
  }

  if (!cart) {
    return loadError ? (
      <p role="alert" class="rounded bg-red-50 px-4 py-2 text-sm text-red-700">
        Could not load your cart: {loadError}
      </p>
    ) : (
      <p class="text-slate-500">Loading your cart…</p>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div class="rounded bg-white p-10 text-center shadow-sm">
        <p class="text-lg font-medium text-slate-700">Your cart is empty</p>
        <a
          href="/"
          class="bg-brand hover:bg-brand-dark mt-3 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
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
                <a
                  href={`/products/${item.productId}`}
                  class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded text-xl font-bold text-slate-500/70 sm:h-20 sm:w-20"
                  style={item.productImage ? undefined : { background: tile.background }}
                >
                  {item.productImage ? (
                    <img src={item.productImage} alt="" class="h-full w-full object-cover" />
                  ) : (
                    tile.glyph
                  )}
                </a>

                <div class="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <a
                      href={`/products/${item.productId}`}
                      class="hover:text-brand truncate font-medium text-slate-800 hover:underline"
                    >
                      {item.productName}
                    </a>
                    <p class="text-xs text-slate-500">Seller: {item.vendorId}</p>
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
                      class="hover:text-brand text-sm font-semibold text-slate-500 uppercase disabled:opacity-50"
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
          <span class="font-medium text-green-700">Free</span>
        </div>
        <div class="flex justify-between py-3 text-base font-bold text-slate-900">
          <span>Total Amount</span>
          <span>{formatMoney(cart.totalInCents, cart.currency)}</span>
        </div>
        <button
          type="button"
          onClick={openCheckout}
          class="bg-brand hover:bg-brand-dark mt-2 w-full rounded-full px-4 py-3 text-sm font-bold tracking-wide text-white uppercase"
        >
          Place Order
        </button>
        <p class="mt-2 text-center text-xs text-slate-500">Cash on Delivery only, for now.</p>
      </div>

      {checkoutStep !== 'closed' && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeCheckout}
        >
          <div
            class="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {checkoutStep === 'address' && (
              <form onSubmit={continueToConfirm}>
                <h2 class="font-heading mb-4 text-lg font-bold text-slate-800">Delivery details</h2>
                <label class="mb-3 block text-sm">
                  <span class="mb-1 block font-medium text-slate-600">Delivery address</span>
                  <textarea
                    required
                    value={deliveryAddress}
                    onInput={(e) => setDeliveryAddress((e.target as HTMLTextAreaElement).value)}
                    rows={3}
                    class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label class="mb-4 block text-sm">
                  <span class="mb-1 block font-medium text-slate-600">Phone number</span>
                  <input
                    type="tel"
                    required
                    value={deliveryPhone}
                    onInput={(e) => setDeliveryPhone((e.target as HTMLInputElement).value)}
                    class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <div class="mb-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-700">
                  <label class="flex items-center gap-2">
                    <input type="radio" checked readonly class="h-4 w-4 accent-[#1341a3]" />
                    Cash on Delivery
                  </label>
                </div>
                <div class="flex gap-3">
                  <button
                    type="button"
                    onClick={closeCheckout}
                    class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="bg-brand hover:bg-brand-dark flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white"
                  >
                    Continue
                  </button>
                </div>
              </form>
            )}

            {checkoutStep === 'confirm' && (
              <div>
                <h2 class="font-heading mb-4 text-lg font-bold text-slate-800">
                  Confirm your order
                </h2>
                {checkoutError && (
                  <p class="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                    {checkoutError}
                  </p>
                )}
                <ul class="mb-4 max-h-40 space-y-2 overflow-y-auto text-sm text-slate-600">
                  {cart.items.map((item) => (
                    <li key={item.productId} class="flex justify-between gap-2">
                      <span class="truncate">
                        {item.productName} × {item.quantity}
                      </span>
                      <span class="shrink-0 font-medium text-slate-800">
                        {formatMoney(item.subtotalInCents, cart.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div class="mb-4 flex justify-between border-t border-dashed border-slate-200 pt-3 text-sm font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatMoney(cart.totalInCents, cart.currency)}</span>
                </div>
                <div class="mb-4 space-y-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-600">
                  <p>
                    <span class="font-medium text-slate-700">Deliver to:</span> {deliveryAddress}
                  </p>
                  <p>
                    <span class="font-medium text-slate-700">Phone:</span> {deliveryPhone}
                  </p>
                  <p>
                    <span class="font-medium text-slate-700">Payment:</span> Cash on Delivery
                  </p>
                </div>
                <div class="flex gap-3">
                  <button
                    type="button"
                    disabled={placing}
                    onClick={() => setCheckoutStep('address')}
                    class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={placing}
                    onClick={placeOrder}
                    class="bg-brand hover:bg-brand-dark flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {placing ? 'Placing…' : 'Confirm Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
