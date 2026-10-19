import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { GetOrCreateCartUseCase } from '@/application/cart/GetOrCreateCartUseCase';
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

  const seller = { id: 'seller-1', role: 'seller' as const };
  const buyerId = 'buyer-1';

  beforeEach(() => {
    products = new InMemoryProductRepository();
    carts = new InMemoryCartRepository();
    ordersRepo = new InMemoryOrderRepository();
    events = new RecordingEventPublisher();
    const getOrCreateCart = new GetOrCreateCartUseCase(carts);
    addItemToCart = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);
    placeOrder = new PlaceOrderUseCase(ordersRepo, carts, products, events);
    cancelOrder = new CancelOrderUseCase(ordersRepo, products, events);
    listOrdersForBuyer = new ListOrdersForBuyerUseCase(ordersRepo);
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

      const buyerOrders = await listOrdersForBuyer.execute(buyerId);
      expect(buyerOrders).toHaveLength(1);
      expect(buyerOrders[0].items).toHaveLength(2);

      const myOrders = await listOrdersForVendor.execute(seller.id);
      expect(myOrders).toHaveLength(1);
      expect(myOrders[0].id).toBe(order.id);
      expect(myOrders[0].items).toHaveLength(1);
      expect(myOrders[0].items[0].productId).toBe(mine.id);

      const theirOrders = await listOrdersForVendor.execute(otherSeller.id);
      expect(theirOrders[0].items).toHaveLength(1);
      expect(theirOrders[0].items[0].productId).toBe(theirs.id);
    });
  });
});
