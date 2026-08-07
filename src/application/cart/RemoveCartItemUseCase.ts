import { Cart } from '../../domain/cart/Cart';
import { ProductId } from '../../domain/product/ProductId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { CartRepository } from '../../domain/cart/CartRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';

export interface RemoveCartItemInput {
  userId: string;
  productId: string;
}

export class RemoveCartItemUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: RemoveCartItemInput): Promise<Cart> {
    const cart = await this.cartRepository.findByUserId(input.userId);
    if (!cart) {
      throw new NotFoundError(`No cart found for user ${input.userId}`);
    }

    cart.removeItem(ProductId.fromString(input.productId));

    await this.cartRepository.save(cart);
    await this.eventPublisher.publish(cart.pullDomainEvents());

    return cart;
  }
}
