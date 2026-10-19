import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleOrderRepository } from '@/infrastructure/repositories/DrizzleOrderRepository';
import { Order } from '@/domain/order/Order';
import { OrderId } from '@/domain/order/OrderId';
import { OrderItem } from '@/domain/order/OrderItem';
import { ProductId } from '@/domain/product/ProductId';
import { VendorId } from '@/domain/product/VendorId';
import { Quantity } from '@/domain/cart/Quantity';
import { Money } from '@/domain/shared/Money';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';

const { db, client } = createTestDb();
const repository = new DrizzleOrderRepository(db);
let buyerId: string;

function mkItem(vendorId: string, overrides: Record<string, unknown> = {}) {
  return new OrderItem({
    productId: ProductId.create(),
    productName: 'Digital Infrared Thermometer',
    productImage: 'https://example.test/thermometer.jpg',
    vendorId: VendorId.fromString(vendorId),
    unitPrice: Money.fromCents(89900),
    quantity: Quantity.of(1),
    ...overrides,
  });
}

function placeOrder(vendorId: string, overrides: Record<string, unknown> = {}) {
  return Order.place({
    buyerId,
    buyerEmail: 'buyer@medikart.test',
    items: [mkItem(vendorId)],
    deliveryAddress: '221B Baker Street',
    deliveryPhone: '9876543210',
    ...overrides,
  });
}

describe('DrizzleOrderRepository', () => {
  beforeEach(async () => {
    await truncateAll(db);
    buyerId = (await seedTestUser(db, 'buyer')).id;
  });

  afterAll(async () => {
    await client.end();
  });

  it('returns null for an unknown order id', async () => {
    expect(await repository.findById(OrderId.create())).toBeNull();
  });

  it('saves an order and retrieves it by id', async () => {
    const sellerId = (await seedTestUser(db, 'seller')).id;
    const order = placeOrder(sellerId);
    await repository.save(order);

    const found = await repository.findById(order.id);
    expect(found).not.toBeNull();
    expect(found?.buyerId).toBe(buyerId);
    expect(found?.status).toBe('placed');
    expect(found?.items).toHaveLength(1);
    expect(found?.items[0].productName).toBe('Digital Infrared Thermometer');
    expect(found?.total.cents).toBe(89900);
  });

  it('persists a status change (cancel) on subsequent saves', async () => {
    const sellerId = (await seedTestUser(db, 'seller')).id;
    const order = placeOrder(sellerId);
    await repository.save(order);

    order.cancel(buyerId);
    await repository.save(order);

    const found = await repository.findById(order.id);
    expect(found?.status).toBe('cancelled');
  });

  it('finds orders by buyer id, most recent first', async () => {
    const sellerId = (await seedTestUser(db, 'seller')).id;
    const first = placeOrder(sellerId);
    await repository.save(first);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = placeOrder(sellerId);
    await repository.save(second);

    const found = await repository.findPageByBuyerId(buyerId, { limit: 10, offset: 0 });
    expect(found.total).toBe(2);
    expect(found.items[0].id.equals(second.id)).toBe(true);

    const secondPage = await repository.findPageByBuyerId(buyerId, { limit: 1, offset: 1 });
    expect(secondPage.total).toBe(2);
    expect(secondPage.items.map((o) => o.id.toString())).toEqual([first.id.toString()]);
  });

  it('persists item fulfillment status and the derived order status', async () => {
    const sellerA = (await seedTestUser(db, 'seller')).id;
    const sellerB = (await seedTestUser(db, 'seller')).id;
    const order = Order.place({
      buyerId,
      buyerEmail: 'buyer@medikart.test',
      items: [mkItem(sellerA), mkItem(sellerB)],
      deliveryAddress: '221B Baker Street',
      deliveryPhone: '9876543210',
    });
    order.advanceFulfillment(VendorId.fromString(sellerA), 'shipped');
    await repository.save(order);

    const found = await repository.findById(order.id);
    expect(found?.status).toBe('shipped');
    expect(found?.statusFor(VendorId.fromString(sellerA))).toBe('shipped');
    expect(found?.statusFor(VendorId.fromString(sellerB))).toBe('placed');

    expect(await repository.countAwaitingShipment(VendorId.fromString(sellerA))).toBe(0);
    expect(await repository.countAwaitingShipment(VendorId.fromString(sellerB))).toBe(1);

    const vendorPage = await repository.findPageByVendorId(VendorId.fromString(sellerB), {
      limit: 10,
      offset: 0,
    });
    expect(vendorPage.total).toBe(1);
  });

  it('knows whether a buyer has received a product', async () => {
    const sellerId = (await seedTestUser(db, 'seller')).id;
    const order = placeOrder(sellerId);
    const productId = order.items[0].productId;
    await repository.save(order);
    expect(await repository.hasDeliveredItem(buyerId, productId)).toBe(false);

    order.advanceFulfillment(VendorId.fromString(sellerId), 'shipped');
    order.advanceFulfillment(VendorId.fromString(sellerId), 'delivered');
    await repository.save(order);
    expect(await repository.hasDeliveredItem(buyerId, productId)).toBe(true);
    expect(await repository.hasDeliveredItem('someone-else', productId)).toBe(false);
  });

  it('finds orders containing at least one item from the given vendor', async () => {
    const sellerA = (await seedTestUser(db, 'seller')).id;
    const sellerB = (await seedTestUser(db, 'seller')).id;

    const orderWithBoth = Order.place({
      buyerId,
      buyerEmail: 'buyer@medikart.test',
      items: [mkItem(sellerA), mkItem(sellerB)],
      deliveryAddress: '221B Baker Street',
      deliveryPhone: '9876543210',
    });
    await repository.save(orderWithBoth);

    const orderWithOnlyB = placeOrder(sellerB);
    await repository.save(orderWithOnlyB);

    const forSellerA = await repository.findByVendorId(VendorId.fromString(sellerA));
    expect(forSellerA).toHaveLength(1);
    expect(forSellerA[0].id.equals(orderWithBoth.id)).toBe(true);

    const forSellerB = await repository.findByVendorId(VendorId.fromString(sellerB));
    expect(forSellerB).toHaveLength(2);
  });
});
