import type { Cart } from '../../domain/cart/Cart';
import { ProductId } from '../../domain/product/ProductId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { UnitOfWork } from '../shared/UnitOfWork';

export interface RemoveCartItemInput {
  userId: string;
  productId: string;
}

export class RemoveCartItemUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: RemoveCartItemInput): Promise<Cart> {
    const cart = await this.unitOfWork.run(async ({ carts }) => {
      const cart = await carts.findByUserIdForUpdate(input.userId);
      if (!cart) {
        throw new NotFoundError(`No cart found for user ${input.userId}`);
      }

      cart.removeItem(ProductId.fromString(input.productId));
      await carts.save(cart);
      return cart;
    });

    await this.eventPublisher.publish(cart.pullDomainEvents());
    return cart;
  }
}
