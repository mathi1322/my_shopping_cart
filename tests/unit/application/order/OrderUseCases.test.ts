import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { AddItemToCartUseCase } from '@/application/cart/AddItemToCartUseCase';
import { PlaceOrderUseCase } from '@/application/order/PlaceOrderUseCase';
import { CancelOrderUseCase } from '@/application/order/CancelOrderUseCase';
import { ListOrdersForBuyerUseCase } from '@/application/order/ListOrdersForBuyerUseCase';
import { ListOrdersForVendorUseCase } from '@/application/order/ListOrdersForVendorUseCase';
import { ConflictError, ForbiddenError } from '@/domain/shared/DomainError';
import { ProductId } from '@/domain/product/ProductId';
import { InMemoryProductRepository } from '../_fakes/InMemoryProductRepository';
import { InMemoryCartRepository } from '../_fakes/InMemoryCartRepository';
import { InMemoryOrderRepository } from '../_fakes/InMemoryOrderRepository';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';
import { InMemoryUnitOfWork } from '../_fakes/InMemoryUnitOfWork';
import { InMemoryVendorDirectory } from '../_fakes/InMemoryVendorDirectory';
import { AdvanceOrderFulfillmentUseCase } from '@/application/order/AdvanceOrderFulfillmentUseCase';
import { Money } from '@/domain/shared/Money';

describe('Order use cases', () => {
  let products: InMemoryProductRepository;
  let carts: InMemoryCartRepository;
  let ordersRepo: InMemoryOrderRepository;
  let events: RecordingEventPublisher;
  let addItemToCart: AddItemToCartUseCase;
  let placeOrder: PlaceOrderUseCase;
  let cancelOrder: CancelOrderUseCase;
  let listOrdersForBuyer: ListOrdersForBuyerUseCase;
  let listOrdersForVendor: ListOrdersForVendorUseCase;
  let advanceFulfillment: AdvanceOrderFulfillmentUseCase;
  let vendors: InMemoryVendorDirectory;

  const seller = { id: 'seller-1', role: 'seller' as const };
  const buyerId = 'buyer-1';

  beforeEach(() => {
    products = new InMemoryProductRepository();
    carts = new InMemoryCartRepository();
    ordersRepo = new InMemoryOrderRepository();
    events = new RecordingEventPublisher();
    const unitOfWork = new InMemoryUnitOfWork({ carts, orders: ordersRepo, products });
    addItemToCart = new AddItemToCartUseCase(unitOfWork, events);
    placeOrder = new PlaceOrderUseCase(unitOfWork, carts, events);
    cancelOrder = new CancelOrderUseCase(unitOfWork, events);
    vendors = new InMemoryVendorDirectory();
    vendors.set(seller.id, 'CareWell Medical');
    listOrdersForBuyer = new ListOrdersForBuyerUseCase(ordersRepo, vendors);
    advanceFulfillment = new AdvanceOrderFulfillmentUseCase(unitOfWork, events);
    listOrdersForVendor = new ListOrdersForVendorUseCase(ordersRepo);
  });

  async function seedProduct(overrides: Record<string, unknown> = {}) {
    return new CreateProductUseCase(products, events).execute(
      {
        name: 'Digital Infrared Thermometer',
        description: 'Non-contact thermometer',
        priceInCents: 89900,
        stockQuantity: 10,
        ...overrides,
      },
      seller,
    );
  }

  describe('PlaceOrderUseCase', () => {
    it('creates an order from the buyer cart, decrements stock, and empties the cart', async () => {
      const product = await seedProduct({ stockQuantity: 5 });
      await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 2 });

      const order = await placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });

      expect(order.status).toBe('placed');
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(2);
      expect(order.totalInCents).toBe(89900 * 2);

      const updatedProduct = await products.findById(ProductId.fromString(product.id));
      expect(updatedProduct?.stockQuantity).toBe(3);

      const cart = await carts.findByUserId(buyerId);
      expect(cart?.isEmpty).toBe(true);
    });

    it('throws ConflictError when the cart is empty', async () => {
      await expect(
        placeOrder.execute({
          buyerId,
          buyerEmail: 'buyer@medikart.test',
          deliveryAddress: '221B Baker Street',
          deliveryPhone: '9876543210',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when stock dropped below the cart quantity before checkout', async () => {
      const product = await seedProduct({ stockQuantity: 5 });
      await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 3 });

      // Someone else buys most of the remaining stock before this buyer checks out.
      const reloaded = await products.findById(ProductId.fromString(product.id));
      reloaded!.updateDetails({ stockQuantity: 1 });
      await products.save(reloaded!);

      await expect(
        placeOrder.execute({
          buyerId,
          buyerEmail: 'buyer@medikart.test',
          deliveryAddress: '221B Baker Street',
          deliveryPhone: '9876543210',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('refuses to place the order and reprices the cart when a price changed after add-to-cart', async () => {
      const product = await seedProduct({ stockQuantity: 5, priceInCents: 89900 });
      await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 2 });

      const reloaded = await products.findById(ProductId.fromString(product.id));
      reloaded!.updateDetails({ price: Money.fromCents(99900) });
      await products.save(reloaded!);

      await expect(
        placeOrder.execute({
          buyerId,
          buyerEmail: 'buyer@medikart.test',
          deliveryAddress: '221B Baker Street',
          deliveryPhone: '9876543210',
        }),
      ).rejects.toThrow(/price of "Digital Infrared Thermometer" has changed/);

      const cart = await carts.findByUserId(buyerId);
      expect(cart?.items[0].unitPrice.cents).toBe(99900);
      expect((await products.findById(ProductId.fromString(product.id)))?.stockQuantity).toBe(5);
      expect((await listOrdersForBuyer.execute(buyerId)).orders).toHaveLength(0);

      // Re-submitting after reviewing the cart goes through at the new price.
      const order = await placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });
      expect(order.totalInCents).toBe(99900 * 2);
    });
  });

  describe('CancelOrderUseCase', () => {
    it('cancels the order and restores product stock', async () => {
      const product = await seedProduct({ stockQuantity: 5 });
      await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 2 });
      const order = await placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });

      const cancelled = await cancelOrder.execute({ orderId: order.id, requestingUserId: buyerId });

      expect(cancelled.status).toBe('cancelled');
      const restoredProduct = await products.findById(ProductId.fromString(product.id));
      expect(restoredProduct?.stockQuantity).toBe(5);
    });

    it('refuses to cancel an order belonging to a different buyer', async () => {
      const product = await seedProduct({ stockQuantity: 5 });
      await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 1 });
      const order = await placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });

      await expect(
        cancelOrder.execute({ orderId: order.id, requestingUserId: 'someone-else' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('refuses a second cancel without restoring stock twice', async () => {
      const product = await seedProduct({ stockQuantity: 5 });
      await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 2 });
      const order = await placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });

      await cancelOrder.execute({ orderId: order.id, requestingUserId: buyerId });
      await expect(
        cancelOrder.execute({ orderId: order.id, requestingUserId: buyerId }),
      ).rejects.toThrow(ConflictError);

      const restoredProduct = await products.findById(ProductId.fromString(product.id));
      expect(restoredProduct?.stockQuantity).toBe(5);
    });
  });

  describe('ListOrdersForBuyerUseCase / ListOrdersForVendorUseCase', () => {
    it('lists a buyer’s own orders and narrows vendor orders to that vendor’s items', async () => {
      const otherSeller = { id: 'seller-2', role: 'seller' as const };
      const mine = await new CreateProductUseCase(products, events).execute(
        {
          name: 'Pulse Oximeter',
          description: 'SpO2 meter',
          priceInCents: 129900,
          stockQuantity: 10,
        },
        seller,
      );
      const theirs = await new CreateProductUseCase(products, events).execute(
        { name: 'N95 Masks', description: 'Pack of 20', priceInCents: 59900, stockQuantity: 10 },
        otherSeller,
      );

      await addItemToCart.execute({ userId: buyerId, productId: mine.id, quantity: 1 });
      await addItemToCart.execute({ userId: buyerId, productId: theirs.id, quantity: 1 });
      const order = await placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });

      const { orders: buyerOrders } = await listOrdersForBuyer.execute(buyerId);
      expect(buyerOrders).toHaveLength(1);
      expect(buyerOrders[0].items).toHaveLength(2);
      expect(buyerOrders[0].items.find((i) => i.productId === mine.id)?.vendorName).toBe(
        'CareWell Medical',
      );

      const { orders: myOrders } = await listOrdersForVendor.execute(seller.id);
      expect(myOrders).toHaveLength(1);
      expect(myOrders[0].id).toBe(order.id);
      expect(myOrders[0].items).toHaveLength(1);
      expect(myOrders[0].items[0].productId).toBe(mine.id);
      expect(myOrders[0].totalInCents).toBe(129900);

      const { orders: theirOrders } = await listOrdersForVendor.execute(otherSeller.id);
      expect(theirOrders[0].items).toHaveLength(1);
      expect(theirOrders[0].items[0].productId).toBe(theirs.id);
    });
  });

  describe('AdvanceOrderFulfillmentUseCase', () => {
    async function placeOrderWith(...productIds: string[]) {
      for (const productId of productIds) {
        await addItemToCart.execute({ userId: buyerId, productId, quantity: 1 });
      }
      return placeOrder.execute({
        buyerId,
        buyerEmail: 'buyer@medikart.test',
        deliveryAddress: '221B Baker Street',
        deliveryPhone: '9876543210',
      });
    }

    it('moves the seller’s items placed → shipped → delivered', async () => {
      const product = await seedProduct();
      const order = await placeOrderWith(product.id);

      const shipped = await advanceFulfillment.execute(
        { orderId: order.id, status: 'shipped' },
        seller,
      );
      expect(shipped.status).toBe('shipped');
      expect(shipped.items[0].fulfillmentStatus).toBe('shipped');

      const delivered = await advanceFulfillment.execute(
        { orderId: order.id, status: 'delivered' },
        seller,
      );
      expect(delivered.status).toBe('delivered');
      expect(events.published.map((e) => e.name)).toContain('order.fulfillment_advanced');
    });

    it('refuses to skip a step or go backwards', async () => {
      const product = await seedProduct();
      const order = await placeOrderWith(product.id);

      await expect(
        advanceFulfillment.execute({ orderId: order.id, status: 'delivered' }, seller),
      ).rejects.toThrow(ConflictError);

      await advanceFulfillment.execute({ orderId: order.id, status: 'shipped' }, seller);
      await expect(
        advanceFulfillment.execute({ orderId: order.id, status: 'shipped' }, seller),
      ).rejects.toThrow(ConflictError);
    });

    it('only lets sellers with items in the order update it', async () => {
      const product = await seedProduct();
      const order = await placeOrderWith(product.id);

      await expect(
        advanceFulfillment.execute(
          { orderId: order.id, status: 'shipped' },
          { id: 'seller-2', role: 'seller' },
        ),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        advanceFulfillment.execute(
          { orderId: order.id, status: 'shipped' },
          { id: buyerId, role: 'buyer' },
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('tracks each seller’s items separately in a multi-seller order', async () => {
      const otherSeller = { id: 'seller-2', role: 'seller' as const };
      const mine = await seedProduct();
      const theirs = await new CreateProductUseCase(products, events).execute(
        { name: 'N95 Masks', description: 'Pack of 20', priceInCents: 59900, stockQuantity: 10 },
        otherSeller,
      );
      const order = await placeOrderWith(mine.id, theirs.id);

      await advanceFulfillment.execute({ orderId: order.id, status: 'shipped' }, seller);
      await advanceFulfillment.execute({ orderId: order.id, status: 'delivered' }, seller);

      const { orders: buyerView } = await listOrdersForBuyer.execute(buyerId);
      // One seller delivered, the other hasn't shipped: the order as a whole is "shipped".
      expect(buyerView[0].status).toBe('shipped');
      expect(buyerView[0].items.find((i) => i.productId === mine.id)?.fulfillmentStatus).toBe(
        'delivered',
      );
      expect(buyerView[0].items.find((i) => i.productId === theirs.id)?.fulfillmentStatus).toBe(
        'placed',
      );

      const theirView = await listOrdersForVendor.execute(otherSeller.id);
      expect(theirView.orders[0].status).toBe('placed');
      expect(theirView.awaitingShipmentCount).toBe(1);
      expect((await listOrdersForVendor.execute(seller.id)).awaitingShipmentCount).toBe(0);
    });

    it('stops the buyer cancelling once anything has shipped, and sellers updating a cancelled order', async () => {
      const product = await seedProduct();
      const shippedOrder = await placeOrderWith(product.id);
      await advanceFulfillment.execute({ orderId: shippedOrder.id, status: 'shipped' }, seller);
      await expect(
        cancelOrder.execute({ orderId: shippedOrder.id, requestingUserId: buyerId }),
      ).rejects.toThrow(/already shipped/);

      const cancelledOrder = await placeOrderWith(product.id);
      await cancelOrder.execute({ orderId: cancelledOrder.id, requestingUserId: buyerId });
      await expect(
        advanceFulfillment.execute({ orderId: cancelledOrder.id, status: 'shipped' }, seller),
      ).rejects.toThrow(/cancelled/);
    });
  });

  describe('order list paging', () => {
    it('pages a buyer’s orders newest first', async () => {
      const product = await seedProduct({ stockQuantity: 100 });
      const ids: string[] = [];
      for (let i = 0; i < 12; i += 1) {
        await addItemToCart.execute({ userId: buyerId, productId: product.id, quantity: 1 });
        const order = await placeOrder.execute({
          buyerId,
          buyerEmail: 'buyer@medikart.test',
          deliveryAddress: '221B Baker Street',
          deliveryPhone: '9876543210',
        });
        ids.push(order.id);
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      const first = await listOrdersForBuyer.execute(buyerId, { page: 1, pageSize: 5 });
      expect(first.orders.map((o) => o.id)).toEqual(ids.slice(-5).reverse());
      expect(first).toMatchObject({ total: 12, page: 1, pageSize: 5, totalPages: 3 });

      const last = await listOrdersForBuyer.execute(buyerId, { page: 3, pageSize: 5 });
      expect(last.orders.map((o) => o.id)).toEqual(ids.slice(0, 2).reverse());
    });
  });
});
