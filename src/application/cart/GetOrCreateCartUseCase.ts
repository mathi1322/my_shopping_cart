import { Cart } from '../../domain/cart/Cart';
import { CartId } from '../../domain/cart/CartId';
import type { CartRepository } from '../../domain/cart/CartRepository';

export class GetOrCreateCartUseCase {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(cartId?: string): Promise<Cart> {
    if (cartId) {
      const existing = await this.cartRepository.findById(CartId.fromString(cartId));
      if (existing) {
        return existing;
      }
    }

    const cart = Cart.create();
    await this.cartRepository.save(cart);
    return cart;
  }
}
