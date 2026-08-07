import { Cart } from '../../domain/cart/Cart';
import type { CartRepository } from '../../domain/cart/CartRepository';

export class GetOrCreateCartUseCase {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(userId: string): Promise<Cart> {
    const existing = await this.cartRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const cart = Cart.create(userId);
    await this.cartRepository.save(cart);
    return cart;
  }
}
