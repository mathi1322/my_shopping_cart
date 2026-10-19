import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { AddItemToCartUseCase } from '@/application/cart/AddItemToCartUseCase';
import { PlaceOrderUseCase } from '@/application/order/PlaceOrderUseCase';
import { CancelOrderUseCase } from '@/application/order/CancelOrderUseCase';
import { GetSellerDashboardUseCase } from '@/application/analytics/GetSellerDashboardUseCase';
import { Order } from '@/domain/order/Order';
import { OrderId } from '@/domain/order/OrderId';
import { OrderItem } from '@/domain/order/OrderItem';
import { ProductId } from '@/domain/product/ProductId';
import { VendorId } from '@/domain/product/VendorId';
import { Quantity } from '@/domain/cart/Quantity';
import { Money } from '@/domain/shared/Money';
import { InMemoryProductRepository } from '../_fakes/InMemoryProductRepository';
import { InMemoryCartRepository } from '../_fakes/InMemoryCartRepository';
import { InMemoryOrderRepository } from '../_fakes/InMemoryOrderRepository';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';
import { InMemoryUnitOfWork } from '../_fakes/InMemoryUnitOfWork';

const seller = { id: 'seller-1', role: 'seller' as const };
const otherSeller = { id: 'seller-2', role: 'seller' as const };

describe('GetSellerDashboardUseCase', () => {
  let products: InMemoryProductRepository;
  let carts: InMemoryCartRepository;
  let ordersRepo: InMemoryOrderRepository;
  let events: RecordingEventPublisher;
  let addItemToCart: AddItemToCartUseCase;
  let placeOrder: PlaceOrderUseCase;
  let cancelOrder: CancelOrderUseCase;
  let getDashboard: GetSellerDashboardUseCase;

  beforeEach(() => {
    products = new InMemoryProductRepository();
    carts = new InMemoryCartRepository();
    ordersRepo = new InMemoryOrderRepository();
    events = new RecordingEventPublisher();
    const unitOfWork = new InMemoryUnitOfWork({ carts, orders: ordersRepo, products });
    addItemToCart = new AddItemToCartUseCase(unitOfWork, events);
    placeOrder = new PlaceOrderUseCase(unitOfWork, carts, events);
    cancelOrder = new CancelOrderUseCase(unitOfWork, events);
    getDashboard = new GetSellerDashboardUseCase(ordersRepo, products);
  });

  async function seedProduct(overrides: Record<string, unknown> = {}) {
    return new CreateProductUseCase(products, events).execute(
      {
        name: 'Digital Infrared Thermometer',
        description: 'Non-contact thermometer',
        priceInCents: 89900,
        stockQuantity: 100,
        category: 'Diagnostic Devices',
        ...overrides,
      },
      seller,
    );
  }

  async function placeOrderFor(buyerId: string, productId: string, quantity: number) {
    await addItemToCart.execute({ userId: buyerId, productId, quantity });
    return placeOrder.execute({
      buyerId,
      buyerEmail: `${buyerId}@medikart.test`,
      deliveryAddress: '221B Baker Street',
      deliveryPhone: '9876543210',
    });
  }

  it('returns an all-zero, empty dashboard when the seller has no orders', async () => {
    const dashboard = await getDashboard.execute(seller.id);

    expect(dashboard.totalOrders).toBe(0);
    expect(dashboard.totalRevenueInCents).toBe(0);
    expect(dashboard.uniqueCustomers).toBe(0);
    expect(dashboard.revenueDeltaPercent).toBeNull();
    expect(dashboard.topProducts).toEqual([]);
    expect(dashboard.categoryBreakdown).toEqual([]);
    expect(dashboard.last14Days).toHaveLength(14);
    expect(dashboard.recentOrders).toEqual([]);
  });

  it('counts revenue and units only from placed orders, excluding cancelled ones', async () => {
    const thermometer = await seedProduct({ priceInCents: 89900 });
    await placeOrderFor('buyer-1', thermometer.id, 2); // stays placed
    const orderB = await placeOrderFor('buyer-2', thermometer.id, 1); // will be cancelled
    await cancelOrder.execute({ orderId: orderB.id, requestingUserId: 'buyer-2' });

    const dashboard = await getDashboard.execute(seller.id);

    expect(dashboard.totalOrders).toBe(2);
    expect(dashboard.placedOrders).toBe(1);
    expect(dashboard.cancelledOrders).toBe(1);
    expect(dashboard.cancellationRatePercent).toBe(50);
    expect(dashboard.totalRevenueInCents).toBe(89900 * 2); // only orderA
    expect(dashboard.totalUnitsSold).toBe(2);
    expect(dashboard.averageOrderValueInCents).toBe(89900 * 2);
  });

  it('counts unique customers across both placed and cancelled orders', async () => {
    const product = await seedProduct();
    await placeOrderFor('buyer-1', product.id, 1);
    const cancelled = await placeOrderFor('buyer-2', product.id, 1);
    await cancelOrder.execute({ orderId: cancelled.id, requestingUserId: 'buyer-2' });
    await placeOrderFor('buyer-1', product.id, 1); // same buyer orders again

    const dashboard = await getDashboard.execute(seller.id);

    expect(dashboard.uniqueCustomers).toBe(2);
    expect(dashboard.totalOrders).toBe(3);
  });

  it('ranks top products by units sold and rolls revenue up by category', async () => {
    const mouse = await seedProduct({
      name: 'Fingertip Pulse Oximeter',
      priceInCents: 129900,
      category: 'Diagnostic Devices',
    });
    const masks = await seedProduct({
      name: 'N95 Masks',
      priceInCents: 59900,
      category: 'PPE & Masks',
    });

    await placeOrderFor('buyer-1', mouse.id, 1);
    await placeOrderFor('buyer-2', masks.id, 5);

    const dashboard = await getDashboard.execute(seller.id);

    expect(dashboard.topProducts[0].productId).toBe(masks.id); // 5 units beats 1
    expect(dashboard.topProducts[0].unitsSold).toBe(5);
    expect(dashboard.topProducts[1].productId).toBe(mouse.id);

    const ppe = dashboard.categoryBreakdown.find((c) => c.category === 'PPE & Masks');
    const diagnostic = dashboard.categoryBreakdown.find((c) => c.category === 'Diagnostic Devices');
    expect(ppe?.revenueInCents).toBe(59900 * 5);
    expect(diagnostic?.revenueInCents).toBe(129900);
  });

  it('only counts orders/items belonging to the requesting vendor', async () => {
    const mine = await seedProduct({ name: 'My Product' });
    const theirs = await new CreateProductUseCase(products, events).execute(
      { name: 'Their Product', description: 'x', priceInCents: 10000, stockQuantity: 10 },
      otherSeller,
    );

    await addItemToCart.execute({ userId: 'buyer-1', productId: mine.id, quantity: 1 });
    await addItemToCart.execute({ userId: 'buyer-1', productId: theirs.id, quantity: 1 });
    await placeOrder.execute({
      buyerId: 'buyer-1',
      buyerEmail: 'buyer-1@medikart.test',
      deliveryAddress: '221B Baker Street',
      deliveryPhone: '9876543210',
    });

    const dashboard = await getDashboard.execute(seller.id);
    expect(dashboard.totalRevenueInCents).toBe(89900);
    expect(dashboard.topProducts).toHaveLength(1);
    expect(dashboard.topProducts[0].productId).toBe(mine.id);
  });

  describe('trend and week-over-week delta', () => {
    function mkOrderOn(daysAgo: number, priceInCents: number) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      return Order.reconstitute({
        id: OrderId.create(),
        buyerId: 'buyer-1',
        buyerEmail: 'buyer-1@medikart.test',
        items: [
          new OrderItem({
            productId: ProductId.create(),
            productName: 'Thermometer',
            productImage: null,
            vendorId: VendorId.fromString(seller.id),
            unitPrice: Money.fromCents(priceInCents),
            quantity: Quantity.of(1),
          }),
        ],
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
        paymentMethod: 'cod',
        status: 'placed',
        createdAt,
        updatedAt: createdAt,
      });
    }

    it('buckets revenue into the last 14 days and computes week-over-week change', async () => {
      await ordersRepo.save(mkOrderOn(10, 10000)); // previous week
      await ordersRepo.save(mkOrderOn(2, 20000)); // last week

      const dashboard = await getDashboard.execute(seller.id);

      expect(dashboard.last14Days).toHaveLength(14);
      const totalBucketed = dashboard.last14Days.reduce((sum, day) => sum + day.revenueInCents, 0);
      expect(totalBucketed).toBe(30000);
      // last week (20000) vs previous week (10000) => +100%
      expect(dashboard.revenueDeltaPercent).toBe(100);
    });

    it('returns null delta when the previous week has no revenue to compare against', async () => {
      await ordersRepo.save(mkOrderOn(1, 15000));

      const dashboard = await getDashboard.execute(seller.id);
      expect(dashboard.revenueDeltaPercent).toBeNull();
    });
  });
});
