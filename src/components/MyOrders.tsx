import { useEffect, useState } from 'preact/hooks';
import { placeholderTile } from '../lib/ui/placeholderTile';

interface OrderItem {
  productId: string;
  productName: string;
  productImage: string | null;
  vendorId: string;
  unitPriceInCents: number;
  quantity: number;
  subtotalInCents: number;
}

interface OrderDto {
  id: string;
  items: OrderItem[];
  deliveryAddress: string;
  deliveryPhone: string;
  paymentMethod: string;
  status: 'placed' | 'cancelled';
  totalInCents: number;
  currency: string;
  createdAt: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MyOrders() {
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState(false);

  async function loadOrders() {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(data.orders);
  }

  useEffect(() => {
    loadOrders();
    setJustPlaced(new URLSearchParams(window.location.search).get('placed') === '1');
  }, []);

  async function cancelOrder(orderId: string) {
    if (!window.confirm('Cancel this order?')) return;
    setError(null);
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not cancel this order');
        return;
      }
      setOrders((current) =>
        current ? current.map((order) => (order.id === orderId ? data : order)) : current,
      );
      window.dispatchEvent(new CustomEvent('orders:updated'));
    } finally {
      setCancellingId(null);
    }
  }

  if (!orders) {
    return <p class="text-slate-500">Loading your orders…</p>;
  }

  if (orders.length === 0) {
    return (
      <div class="rounded-2xl border border-blue-200 bg-white p-10 text-center">
        <p class="text-lg font-medium text-slate-700">You haven't placed any orders yet</p>
        <a
          href="/"
          class="bg-brand hover:bg-brand-dark mt-3 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          Shop now
        </a>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      {justPlaced && (
        <p class="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Order placed successfully — pay cash on delivery.
        </p>
      )}
      {error && <p class="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {orders.map((order) => (
        <div key={order.id} class="rounded-2xl border border-blue-200 bg-white p-4 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <p class="text-xs text-slate-400">Order #{order.id.slice(0, 8)}</p>
              <p class="text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
            </div>
            <span
              class={`rounded border px-2 py-1 text-xs font-medium ${
                order.status === 'placed'
                  ? 'border-green-200 text-green-700'
                  : 'border-red-200 text-red-600'
              }`}
            >
              {order.status === 'placed' ? 'Placed' : 'Cancelled'}
            </span>
          </div>

          <ul class="divide-y divide-slate-100">
            {order.items.map((item) => {
              const tile = placeholderTile(item.productName);
              return (
                <li key={item.productId} class="flex gap-3 py-3">
                  <a
                    href={`/products/${item.productId}`}
                    class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded text-base font-bold text-slate-500/70"
                    style={item.productImage ? undefined : { background: tile.background }}
                  >
                    {item.productImage ? (
                      <img src={item.productImage} alt="" class="h-full w-full object-cover" />
                    ) : (
                      tile.glyph
                    )}
                  </a>
                  <div class="flex min-w-0 flex-1 flex-col justify-center">
                    <a
                      href={`/products/${item.productId}`}
                      class="hover:text-brand truncate text-sm font-medium text-slate-800 hover:underline"
                    >
                      {item.productName}
                    </a>
                    <p class="text-xs text-slate-400">Qty {item.quantity}</p>
                  </div>
                  <p class="shrink-0 self-center text-sm font-semibold text-slate-900">
                    {formatMoney(item.subtotalInCents, order.currency)}
                  </p>
                </li>
              );
            })}
          </ul>

          <div class="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-3">
            <div class="text-xs text-slate-500">
              <p>
                <span class="font-medium text-slate-600">Deliver to:</span> {order.deliveryAddress}
              </p>
              <p>
                <span class="font-medium text-slate-600">Phone:</span> {order.deliveryPhone} ·{' '}
                <span class="font-medium text-slate-600">Payment:</span> Cash on Delivery
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold text-slate-900">
                Total: {formatMoney(order.totalInCents, order.currency)}
              </p>
              {order.status === 'placed' && (
                <button
                  type="button"
                  disabled={cancellingId === order.id}
                  onClick={() => cancelOrder(order.id)}
                  class="mt-1 text-sm font-semibold text-red-600 uppercase hover:underline disabled:opacity-50"
                >
                  {cancellingId === order.id ? 'Cancelling…' : 'Cancel Order'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
