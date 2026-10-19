import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { GetOrCreateCartUseCase } from '@/application/cart/GetOrCreateCartUseCase';
import { AddItemToCartUseCase } from '@/application/cart/AddItemToCartUseCase';
import { UpdateCartItemQuantityUseCase } from '@/application/cart/UpdateCartItemQuantityUseCase';
import { RemoveCartItemUseCase } from '@/application/cart/RemoveCartItemUseCase';
import { toCartDto } from '@/application/cart/CartDto';
import { ConflictError, NotFoundError } from '@/domain/shared/DomainError';
import { InMemoryProductRepository } from '../_fakes/InMemoryProductRepository';
import { InMemoryCartRepository } from '../_fakes/InMemoryCartRepository';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';
import { InMemoryOrderRepository } from '../_fakes/InMemoryOrderRepository';
import { InMemoryUnitOfWork } from '../_fakes/InMemoryUnitOfWork';

describe('Cart use cases', () => {
  let products: InMemoryProductRepository;
  let carts: InMemoryCartRepository;
  let events: RecordingEventPublisher;
  let getOrCreateCart: GetOrCreateCartUseCase;
  let unitOfWork: InMemoryUnitOfWork;

  const buyerId = 'buyer-1';
  const otherBuyerId = 'buyer-2';

  beforeEach(() => {
    products = new InMemoryProductRepository();
    carts = new InMemoryCartRepository();
    events = new RecordingEventPublisher();
    getOrCreateCart = new GetOrCreateCartUseCase(carts);
    unitOfWork = new InMemoryUnitOfWork({ carts, orders: new InMemoryOrderRepository(), products });
  });

  const seller = { id: 'seller-1', role: 'seller' as const };

  async function seedProduct(overrides: Partial<Parameters<typeof mkProduct>[0]> = {}) {
    return new CreateProductUseCase(products, events).execute(mkProduct(overrides), seller);
  }

  function mkProduct(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Wireless Mouse',
      description: 'A reliable wireless mouse',
      priceInCents: 1999,
      stockQuantity: 5,
      ...overrides,
    };
  }

  describe('GetOrCreateCartUseCase', () => {
    it('creates a new cart for a user with no existing cart', async () => {
      const cart = await getOrCreateCart.execute(buyerId);
      expect(cart.isEmpty).toBe(true);
      expect(await carts.findById(cart.id)).not.toBeNull();
    });

    it('returns the existing cart for a known user', async () => {
      const cart = await getOrCreateCart.execute(buyerId);
      const again = await getOrCreateCart.execute(buyerId);
      expect(again.id.equals(cart.id)).toBe(true);
    });

    it('gives different users different carts', async () => {
      const mine = await getOrCreateCart.execute(buyerId);
      const theirs = await getOrCreateCart.execute(otherBuyerId);
      expect(mine.id.equals(theirs.id)).toBe(false);
    });
  });

  describe('AddItemToCartUseCase', () => {
    it('adds a product to a new cart and returns totals', async () => {
      const product = await seedProduct();
      const useCase = new AddItemToCartUseCase(unitOfWork, events);

      const cart = await useCase.execute({ userId: buyerId, productId: product.id, quantity: 2 });
      const dto = toCartDto(cart);

      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].quantity).toBe(2);
      expect(dto.totalInCents).toBe(3998);
    });

    it('merges quantities when adding the same product twice for the same user', async () => {
      const product = await seedProduct({ stockQuantity: 10 });
      const useCase = new AddItemToCartUseCase(unitOfWork, events);

      await useCase.execute({ userId: buyerId, productId: product.id, quantity: 2 });
      const second = await useCase.execute({
        userId: buyerId,
        productId: product.id,
        quantity: 3,
      });

      expect(second.items).toHaveLength(1);
      expect(toCartDto(second).items[0].quantity).toBe(5);
    });

    it('keeps carts isolated between different users', async () => {
      const product = await seedProduct({ stockQuantity: 10 });
      const useCase = new AddItemToCartUseCase(unitOfWork, events);

      await useCase.execute({ userId: buyerId, productId: product.id, quantity: 2 });
      const theirs = await useCase.execute({
        userId: otherBuyerId,
        productId: product.id,
        quantity: 1,
      });

      expect(toCartDto(theirs).items[0].quantity).toBe(1);
      const mine = await getOrCreateCart.execute(buyerId);
      expect(toCartDto(mine).items[0].quantity).toBe(2);
    });

    it('throws NotFoundError for an unknown product', async () => {
      const useCase = new AddItemToCartUseCase(unitOfWork, events);
      await expect(
        useCase.execute({ userId: buyerId, productId: 'missing', quantity: 1 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when requested quantity exceeds available stock', async () => {
      const product = await seedProduct({ stockQuantity: 1 });
      const useCase = new AddItemToCartUseCase(unitOfWork, events);

      await expect(
        useCase.execute({ userId: buyerId, productId: product.id, quantity: 2 }),
      ).rejects.toThrow(ConflictError);
    });

    it('accounts for quantity already in the cart when checking stock', async () => {
      const product = await seedProduct({ stockQuantity: 2 });
      const useCase = new AddItemToCartUseCase(unitOfWork, events);

      await useCase.execute({ userId: buyerId, productId: product.id, quantity: 2 });
      await expect(
        useCase.execute({ userId: buyerId, productId: product.id, quantity: 1 }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('UpdateCartItemQuantityUseCase', () => {
    it('updates the quantity of an item already in the cart', async () => {
      const product = await seedProduct({ stockQuantity: 10 });
      const addUseCase = new AddItemToCartUseCase(unitOfWork, events);
      await addUseCase.execute({ userId: buyerId, productId: product.id, quantity: 1 });

      const useCase = new UpdateCartItemQuantityUseCase(unitOfWork, events);
      const updated = await useCase.execute({
        userId: buyerId,
        productId: product.id,
        quantity: 4,
      });

      expect(toCartDto(updated).items[0].quantity).toBe(4);
    });

    it('throws NotFoundError for a user with no cart', async () => {
      const useCase = new UpdateCartItemQuantityUseCase(unitOfWork, events);
      await expect(
        useCase.execute({
          userId: 'no-cart-user',
          productId: 'missing',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the new quantity exceeds available stock', async () => {
      const product = await seedProduct({ stockQuantity: 3 });
      const addUseCase = new AddItemToCartUseCase(unitOfWork, events);
      await addUseCase.execute({ userId: buyerId, productId: product.id, quantity: 1 });

      const useCase = new UpdateCartItemQuantityUseCase(unitOfWork, events);
      await expect(
        useCase.execute({ userId: buyerId, productId: product.id, quantity: 4 }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('RemoveCartItemUseCase', () => {
    it('removes an item from the cart', async () => {
      const product = await seedProduct();
      const addUseCase = new AddItemToCartUseCase(unitOfWork, events);
      await addUseCase.execute({ userId: buyerId, productId: product.id, quantity: 1 });

      const useCase = new RemoveCartItemUseCase(unitOfWork, events);
      const updated = await useCase.execute({
        userId: buyerId,
        productId: product.id,
      });

      expect(updated.isEmpty).toBe(true);
    });

    it('throws NotFoundError for a user with no cart', async () => {
      const useCase = new RemoveCartItemUseCase(unitOfWork, events);
      await expect(useCase.execute({ userId: 'no-cart-user', productId: 'x' })).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
