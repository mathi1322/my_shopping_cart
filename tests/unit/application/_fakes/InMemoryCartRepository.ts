import type { Cart } from '@/domain/cart/Cart';
import type { CartId } from '@/domain/cart/CartId';
import type { CartRepository } from '@/domain/cart/CartRepository';

export class InMemoryCartRepository implements CartRepository {
  private readonly carts = new Map<string, Cart>();

  async findById(id: CartId): Promise<Cart | null> {
    return this.carts.get(id.toString()) ?? null;
  }

  async findByUserId(userId: string): Promise<Cart | null> {
    return [...this.carts.values()].find((cart) => cart.userId === userId) ?? null;
  }

  async save(cart: Cart): Promise<void> {
    this.carts.set(cart.id.toString(), cart);
  }
}
