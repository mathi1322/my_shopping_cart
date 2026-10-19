import type { Order } from './Order';
import type { OrderId } from './OrderId';
import type { VendorId } from '../product/VendorId';
import type { ProductId } from '../product/ProductId';
import type { Page, PageRequest } from '../shared/Pagination';

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  /** Like findById, but row-locks the order until the surrounding UnitOfWork ends. */
  findByIdForUpdate(id: OrderId): Promise<Order | null>;
  /** A buyer's orders, newest first. */
  findPageByBuyerId(buyerId: string, page: PageRequest): Promise<Page<Order>>;
  /** Orders containing at least one of this vendor's items, newest first. */
  findPageByVendorId(vendorId: VendorId, page: PageRequest): Promise<Page<Order>>;
  /** Every order containing this vendor's items — for analytics. */
  findByVendorId(vendorId: VendorId): Promise<Order[]>;
  /** Orders where this vendor still has items to ship. */
  countAwaitingShipment(vendorId: VendorId): Promise<number>;
  /** Whether the buyer has received this product (a delivered, non-cancelled item). */
  hasDeliveredItem(buyerId: string, productId: ProductId): Promise<boolean>;
}
