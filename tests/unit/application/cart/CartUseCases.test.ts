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

describe('Cart use cases', () => {
  let products: InMemoryProductRepository;
  let carts: InMemoryCartRepository;
  let events: RecordingEventPublisher;
  let getOrCreateCart: GetOrCreateCartUseCase;

  beforeEach(() => {
    products = new InMemoryProductRepository();
    carts = new InMemoryCartRepository();
    events = new RecordingEventPublisher();
    getOrCreateCart = new GetOrCreateCartUseCase(carts);
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
    it('creates a new cart when no id is given', async () => {
      const cart = await getOrCreateCart.execute();
      expect(cart.isEmpty).toBe(true);
      expect(await carts.findById(cart.id)).not.toBeNull();
    });

    it('returns the existing cart for a known id', async () => {
      const cart = await getOrCreateCart.execute();
      const again = await getOrCreateCart.execute(cart.id.toString());
      expect(again.id.equals(cart.id)).toBe(true);
    });

    it('creates a fresh cart when the given id is unknown', async () => {
      const cart = await getOrCreateCart.execute('00000000-0000-0000-0000-000000000000');
      expect(cart.id.toString()).not.toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('AddItemToCartUseCase', () => {
    it('adds a product to a new cart and returns totals', async () => {
      const product = await seedProduct();
      const useCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);

      const cart = await useCase.execute({ productId: product.id, quantity: 2 });
      const dto = toCartDto(cart);

      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].quantity).toBe(2);
      expect(dto.totalInCents).toBe(3998);
    });

    it('merges quantities when adding the same product twice to the same cart', async () => {
      const product = await seedProduct({ stockQuantity: 10 });
      const useCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);

      const first = await useCase.execute({ productId: product.id, quantity: 2 });
      const second = await useCase.execute({
        cartId: first.id.toString(),
        productId: product.id,
        quantity: 3,
      });

      expect(second.items).toHaveLength(1);
      expect(toCartDto(second).items[0].quantity).toBe(5);
    });

    it('throws NotFoundError for an unknown product', async () => {
      const useCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);
      await expect(useCase.execute({ productId: 'missing', quantity: 1 })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws ConflictError when requested quantity exceeds available stock', async () => {
      const product = await seedProduct({ stockQuantity: 1 });
      const useCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);

      await expect(useCase.execute({ productId: product.id, quantity: 2 })).rejects.toThrow(
        ConflictError,
      );
    });

    it('accounts for quantity already in the cart when checking stock', async () => {
      const product = await seedProduct({ stockQuantity: 2 });
      const useCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);

      const cart = await useCase.execute({ productId: product.id, quantity: 2 });
      await expect(
        useCase.execute({ cartId: cart.id.toString(), productId: product.id, quantity: 1 }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('UpdateCartItemQuantityUseCase', () => {
    it('updates the quantity of an item already in the cart', async () => {
      const product = await seedProduct({ stockQuantity: 10 });
      const addUseCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);
      const cart = await addUseCase.execute({ productId: product.id, quantity: 1 });

      const useCase = new UpdateCartItemQuantityUseCase(carts, products, events);
      const updated = await useCase.execute({
        cartId: cart.id.toString(),
        productId: product.id,
        quantity: 4,
      });

      expect(toCartDto(updated).items[0].quantity).toBe(4);
    });

    it('throws NotFoundError for an unknown cart', async () => {
      const useCase = new UpdateCartItemQuantityUseCase(carts, products, events);
      await expect(
        useCase.execute({
          cartId: '00000000-0000-0000-0000-000000000000',
          productId: 'missing',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the new quantity exceeds available stock', async () => {
      const product = await seedProduct({ stockQuantity: 3 });
      const addUseCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);
      const cart = await addUseCase.execute({ productId: product.id, quantity: 1 });

      const useCase = new UpdateCartItemQuantityUseCase(carts, products, events);
      await expect(
        useCase.execute({ cartId: cart.id.toString(), productId: product.id, quantity: 4 }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('RemoveCartItemUseCase', () => {
    it('removes an item from the cart', async () => {
      const product = await seedProduct();
      const addUseCase = new AddItemToCartUseCase(carts, products, getOrCreateCart, events);
      const cart = await addUseCase.execute({ productId: product.id, quantity: 1 });

      const useCase = new RemoveCartItemUseCase(carts, events);
      const updated = await useCase.execute({
        cartId: cart.id.toString(),
        productId: product.id,
      });

      expect(updated.isEmpty).toBe(true);
    });

    it('throws NotFoundError for an unknown cart', async () => {
      const useCase = new RemoveCartItemUseCase(carts, events);
      await expect(
        useCase.execute({ cartId: '00000000-0000-0000-0000-000000000000', productId: 'x' }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
