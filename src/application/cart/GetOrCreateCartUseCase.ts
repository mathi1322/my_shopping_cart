import { Cart } from '../../domain/cart/Cart';
import type { CartRepository } from '../../domain/cart/CartRepository';

export class GetOrCreateCartUseCase {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(userId: string): Promise<Cart> {
    const existing = await this.cartRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    // Concurrent first requests (e.g. the cart badge and an add-to-cart right after
    // login) may both get here; createIfAbsent lets exactly one of them create it.
    await this.cartRepository.createIfAbsent(Cart.create(userId));
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) {
      throw new Error(`Cart for user ${userId} vanished right after creation`);
    }
    return cart;
  }
}
