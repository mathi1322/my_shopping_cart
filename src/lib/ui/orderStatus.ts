export type OrderStatusValue = 'placed' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_STYLES: Record<OrderStatusValue, { label: string; classes: string }> = {
  placed: { label: 'Placed', classes: 'bg-blue-50 text-blue-800' },
  shipped: { label: 'Shipped', classes: 'bg-amber-50 text-amber-800' },
  delivered: { label: 'Delivered', classes: 'bg-green-50 text-green-800' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-50 text-red-700' },
};

/** Label and badge colours (WCAG AA) for an order or item status. */
export function orderStatusStyle(status: OrderStatusValue): { label: string; classes: string } {
  return STATUS_STYLES[status];
}
