import type { Order } from '@/domain/order/Order';
import type { OrderId } from '@/domain/order/OrderId';
import type { VendorId } from '@/domain/product/VendorId';
import type { OrderRepository } from '@/domain/order/OrderRepository';

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

  async findByBuyerId(buyerId: string): Promise<Order[]> {
    return [...this.orders.values()].filter((order) => order.buyerId === buyerId);
  }

  async findByVendorId(vendorId: VendorId): Promise<Order[]> {
    return [...this.orders.values()].filter((order) =>
      order.items.some((item) => item.vendorId.equals(vendorId)),
    );
  }
}
