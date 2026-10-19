import { useEffect, useState } from 'preact/hooks';
import { placeholderTile } from '../lib/ui/placeholderTile';
import { fetchJson } from '../lib/ui/fetchJson';
import { orderStatusStyle, type OrderStatusValue } from '../lib/ui/orderStatus';

interface OrderItem {
  productId: string;
  productName: string;
  productImage: string | null;
  vendorId: string;
  unitPriceInCents: number;
  quantity: number;
  subtotalInCents: number;
}

interface OrdersPage {
  orders: OrderDto[];
  page: number;
  totalPages: number;
  total: number;
}

/** The one action a seller can take next on their items in an order. */
const NEXT_STEP: Partial<
  Record<OrderStatusValue, { status: 'shipped' | 'delivered'; label: string }>
> = {
  placed: { status: 'shipped', label: 'Mark as shipped' },
  shipped: { status: 'delivered', label: 'Mark as delivered' },
};

interface OrderDto {
  id: string;
  buyerEmail: string;
  items: OrderItem[];
  deliveryAddress: string;
  deliveryPhone: string;
  status: OrderStatusValue;
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

export default function SellerOrders() {
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(page = 1) {
    const result = await fetchJson<OrdersPage>(`/api/orders/received?page=${page}`);
    if (!result.ok) {
      if (page === 1) setLoadError(result.message);
      else setError(result.message);
      return;
    }
    setLoadError(null);
    const { orders: pageOrders, totalPages, total } = result.data;
    setOrders((current) => (page === 1 || !current ? pageOrders : [...current, ...pageOrders]));
    setPageInfo({ page, totalPages, total });
  }

  useEffect(() => {
    load();
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    await load(pageInfo.page + 1);
    setLoadingMore(false);
  }

  async function advance(orderId: string, status: 'shipped' | 'delivered') {
    setError(null);
    setUpdatingId(orderId);
    const result = await fetchJson<OrderDto>(`/api/orders/${orderId}/fulfillment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setUpdatingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const updated = result.data;
    setOrders((current) =>
      current ? current.map((order) => (order.id === orderId ? updated : order)) : current,
    );
    // Lets the header refresh its "to ship" badge.
    window.dispatchEvent(new CustomEvent('orders:updated'));
  }

  if (!orders) {
    return loadError ? (
      <p role="alert" class="rounded bg-red-50 px-4 py-2 text-sm text-red-700">
        Could not load orders: {loadError}
      </p>
    ) : (
      <p class="text-slate-500">Loading orders…</p>
    );
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
      {error && (
        <p role="alert" class="rounded bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {orders.map((order) => {
        const itemsTotal = order.items.reduce((sum, item) => sum + item.subtotalInCents, 0);
        return (
          <div key={order.id} class="rounded-2xl border border-blue-200 bg-white p-4 sm:p-6">
            <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <p class="text-xs text-slate-500">Order #{order.id.slice(0, 8)}</p>
                <p class="text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
                <p class="mt-1 text-sm">
                  <span class="font-medium text-slate-600">Buyer:</span> {order.buyerEmail}
                </p>
              </div>
              <div class="flex flex-col items-end gap-2">
                <span
                  class={`rounded px-2 py-1 text-xs font-medium ${orderStatusStyle(order.status).classes}`}
                >
                  {orderStatusStyle(order.status).label}
                </span>
                {NEXT_STEP[order.status] && (
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => advance(order.id, NEXT_STEP[order.status]!.status)}
                    class="bg-brand hover:bg-brand-dark rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {updatingId === order.id ? 'Updating…' : NEXT_STEP[order.status]!.label}
                  </button>
                )}
              </div>
            </div>

            <ul class="divide-y divide-slate-100">
              {order.items.map((item) => {
                const tile = placeholderTile(item.productName);
                return (
                  <li key={item.productId} class="flex gap-3 py-3">
                    <a
                      href={`/products/${item.productId}`}
                      class={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded text-base font-bold text-slate-500/70 ${item.productImage ? '' : tile.className}`}
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
                      <p class="text-xs text-slate-500">Qty {item.quantity}</p>
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

      {pageInfo.page < pageInfo.totalPages && (
        <div class="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            class="border-brand text-brand rounded-full border bg-white px-5 py-2 text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : `Load more orders (${orders.length} of ${pageInfo.total})`}
          </button>
        </div>
      )}
    </div>
  );
}
