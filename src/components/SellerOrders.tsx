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
  buyerEmail: string;
  items: OrderItem[];
  deliveryAddress: string;
  deliveryPhone: string;
  status: 'placed' | 'cancelled';
  currency: string;
  createdAt: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SellerOrders() {
  const [orders, setOrders] = useState<OrderDto[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/orders/received');
      const data = await res.json();
      setOrders(data.orders);
    }
    load();
    window.addEventListener('orders:updated', load);
    return () => window.removeEventListener('orders:updated', load);
  }, []);

  if (!orders) {
    return <p class="text-slate-500">Loading orders…</p>;
  }

  if (orders.length === 0) {
    return (
      <div class="rounded-2xl border border-blue-200 bg-white p-10 text-center">
        <p class="text-lg font-medium text-slate-700">No orders yet</p>
        <p class="mt-1 text-sm text-slate-500">
          Orders placed for your products will show up here.
        </p>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      {orders.map((order) => {
        const itemsTotal = order.items.reduce((sum, item) => sum + item.subtotalInCents, 0);
        return (
          <div key={order.id} class="rounded-2xl border border-blue-200 bg-white p-4 sm:p-6">
            <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <p class="text-xs text-slate-400">Order #{order.id.slice(0, 8)}</p>
                <p class="text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
                <p class="mt-1 text-sm">
                  <span class="font-medium text-slate-600">Buyer:</span> {order.buyerEmail}
                </p>
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
                        class="truncate text-sm font-medium text-slate-800 hover:text-brand hover:underline"
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
                  <span class="font-medium text-slate-600">Deliver to:</span>{' '}
                  {order.deliveryAddress}
                </p>
                <p>
                  <span class="font-medium text-slate-600">Phone:</span> {order.deliveryPhone} ·{' '}
                  <span class="font-medium text-slate-600">Payment:</span> Cash on Delivery
                </p>
              </div>
              <p class="text-sm font-bold text-slate-900">
                Your total: {formatMoney(itemsTotal, order.currency)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
