import type { Order } from '@/domain/order/Order';
import type { OrderId } from '@/domain/order/OrderId';
import type { VendorId } from '@/domain/product/VendorId';
import type { OrderRepository } from '@/domain/order/OrderRepository';
import type { ProductId } from '@/domain/product/ProductId';
import type { Page, PageRequest } from '@/domain/shared/Pagination';

function newestFirst(a: Order, b: Order): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function paginate(orders: Order[], page: PageRequest): Page<Order> {
  const sorted = [...orders].sort(newestFirst);
  return { items: sorted.slice(page.offset, page.offset + page.limit), total: sorted.length };
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id.toString(), order);
  }

  async findById(id: OrderId): Promise<Order | null> {
    return this.orders.get(id.toString()) ?? null;
  }

  async findByIdForUpdate(id: OrderId): Promise<Order | null> {
    return this.findById(id);
  }

  async findPageByBuyerId(buyerId: string, page: PageRequest): Promise<Page<Order>> {
    return paginate(
      [...this.orders.values()].filter((order) => order.buyerId === buyerId),
      page,
    );
  }

  async findPageByVendorId(vendorId: VendorId, page: PageRequest): Promise<Page<Order>> {
    return paginate(await this.findByVendorId(vendorId), page);
  }

  async countAwaitingShipment(vendorId: VendorId): Promise<number> {
    return (await this.findByVendorId(vendorId)).filter(
      (order) => order.statusFor(vendorId) === 'placed',
    ).length;
  }

  async hasDeliveredItem(buyerId: string, productId: ProductId): Promise<boolean> {
    return [...this.orders.values()].some(
      (order) =>
        order.buyerId === buyerId &&
        order.status !== 'cancelled' &&
        order.items.some(
          (item) => item.productId.equals(productId) && item.fulfillmentStatus === 'delivered',
        ),
    );
  }

  async findByVendorId(vendorId: VendorId): Promise<Order[]> {
    return [...this.orders.values()].filter((order) =>
      order.items.some((item) => item.vendorId.equals(vendorId)),
    );
  }
}
