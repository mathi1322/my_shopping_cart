import type { Order } from './Order';
import type { OrderId } from './OrderId';
import type { VendorId } from '../product/VendorId';

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByBuyerId(buyerId: string): Promise<Order[]>;
  findByVendorId(vendorId: VendorId): Promise<Order[]>;
}
