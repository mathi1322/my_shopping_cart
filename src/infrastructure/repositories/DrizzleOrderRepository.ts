import { and, count, countDistinct, desc, eq, inArray, ne } from 'drizzle-orm';
import type { Database } from '../db/client';
import { orders, orderItems } from '../db/schema';
import { Order } from '../../domain/order/Order';
import type { OrderStatus, PaymentMethod } from '../../domain/order/Order';
import { OrderId } from '../../domain/order/OrderId';
import { OrderItem } from '../../domain/order/OrderItem';
import { ProductId } from '../../domain/product/ProductId';
import { VendorId } from '../../domain/product/VendorId';
import { Quantity } from '../../domain/cart/Quantity';
import { Money } from '../../domain/shared/Money';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { Page, PageRequest } from '../../domain/shared/Pagination';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

function itemToDomain(row: OrderItemRow): OrderItem {
  return new OrderItem({
    productId: ProductId.fromString(row.productId),
    productName: row.productName,
    productImage: row.productImage,
    vendorId: VendorId.fromString(row.vendorId),
    unitPrice: Money.fromCents(row.unitPriceInCents, row.currency),
    quantity: Quantity.of(row.quantity),
    fulfillmentStatus: row.fulfillmentStatus,
  });
}

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  async save(order: Order): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(orders)
        .values({
          id: order.id.toString(),
          buyerId: order.buyerId,
          buyerEmail: order.buyerEmail,
          deliveryAddress: order.deliveryAddress,
          deliveryPhone: order.deliveryPhone,
          paymentMethod: order.paymentMethod,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })
        .onConflictDoUpdate({
          target: orders.id,
          set: { status: order.status, updatedAt: order.updatedAt },
        });

      await tx.delete(orderItems).where(eq(orderItems.orderId, order.id.toString()));

      if (order.items.length > 0) {
        await tx.insert(orderItems).values(
          order.items.map((item) => ({
            orderId: order.id.toString(),
            productId: item.productId.toString(),
            productName: item.productName,
            productImage: item.productImage,
            vendorId: item.vendorId.toString(),
            unitPriceInCents: item.unitPrice.cents,
            currency: item.unitPrice.currencyCode,
            quantity: item.quantity.value,
            fulfillmentStatus: item.fulfillmentStatus,
          })),
        );
      }
    });
  }

  async findById(id: OrderId): Promise<Order | null> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id.toString())).limit(1);
    return row ? this.hydrate(row) : null;
  }

  async findByIdForUpdate(id: OrderId): Promise<Order | null> {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id.toString()))
      .limit(1)
      .for('update');
    return row ? this.hydrate(row) : null;
  }

  async findPageByBuyerId(buyerId: string, page: PageRequest): Promise<Page<Order>> {
    const where = eq(orders.buyerId, buyerId);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ total: count() }).from(orders).where(where),
    ]);
    return { items: await this.hydrateMany(rows), total };
  }

  async findPageByVendorId(vendorId: VendorId, page: PageRequest): Promise<Page<Order>> {
    const where = inArray(orders.id, this.orderIdsForVendor(vendorId));
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ total: count() }).from(orders).where(where),
    ]);
    return { items: await this.hydrateMany(rows), total };
  }

  async countAwaitingShipment(vendorId: VendorId): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: countDistinct(orderItems.orderId) })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.vendorId, vendorId.toString()),
          eq(orderItems.fulfillmentStatus, 'placed'),
          ne(orders.status, 'cancelled'),
        ),
      );
    return total;
  }

  async hasDeliveredItem(buyerId: string, productId: ProductId): Promise<boolean> {
    const rows = await this.db
      .select({ orderId: orderItems.orderId })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.buyerId, buyerId),
          ne(orders.status, 'cancelled'),
          eq(orderItems.productId, productId.toString()),
          eq(orderItems.fulfillmentStatus, 'delivered'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  private orderIdsForVendor(vendorId: VendorId) {
    return this.db
      .selectDistinct({ orderId: orderItems.orderId })
      .from(orderItems)
      .where(eq(orderItems.vendorId, vendorId.toString()));
  }

  async findByVendorId(vendorId: VendorId): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(inArray(orders.id, this.orderIdsForVendor(vendorId)))
      .orderBy(desc(orders.createdAt), desc(orders.id));
    return this.hydrateMany(rows);
  }

  private async hydrate(row: OrderRow): Promise<Order> {
    const [order] = await this.hydrateMany([row]);
    return order;
  }

  /** Loads every order's line items in one query rather than one query per order. */
  private async hydrateMany(rows: OrderRow[]): Promise<Order[]> {
    if (rows.length === 0) {
      return [];
    }

    const itemRows = await this.db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((row) => row.id),
        ),
      );

    const itemsByOrderId = new Map<string, OrderItemRow[]>();
    for (const itemRow of itemRows) {
      const items = itemsByOrderId.get(itemRow.orderId) ?? [];
      items.push(itemRow);
      itemsByOrderId.set(itemRow.orderId, items);
    }

    return rows.map((row) => toDomain(row, itemsByOrderId.get(row.id) ?? []));
  }
}

function toDomain(row: OrderRow, itemRows: OrderItemRow[]): Order {
  return Order.reconstitute({
    id: OrderId.fromString(row.id),
    buyerId: row.buyerId,
    buyerEmail: row.buyerEmail,
    items: itemRows.map(itemToDomain),
    deliveryAddress: row.deliveryAddress,
    deliveryPhone: row.deliveryPhone,
    paymentMethod: row.paymentMethod as PaymentMethod,
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
