import type { Cart } from '../../domain/cart/Cart';
import { Quantity } from '../../domain/cart/Quantity';
import { ProductId } from '../../domain/product/ProductId';
import { ConflictError, NotFoundError } from '../../domain/shared/DomainError';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { UnitOfWork } from '../shared/UnitOfWork';

export interface UpdateCartItemQuantityInput {
  userId: string;
  productId: string;
  quantity: number;
}

export class UpdateCartItemQuantityUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: UpdateCartItemQuantityInput): Promise<Cart> {
    const cart = await this.unitOfWork.run(async ({ carts, products }) => {
      const cart = await carts.findByUserIdForUpdate(input.userId);
      if (!cart) {
        throw new NotFoundError(`No cart found for user ${input.userId}`);
      }

      const productId = ProductId.fromString(input.productId);
      const quantity = Quantity.of(input.quantity);

      const product = await products.findById(productId);
      if (!product) {
        throw new NotFoundError(`Product ${input.productId} not found`);
      }
      if (!product.hasStockFor(quantity.value)) {
        throw new ConflictError(
          `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
        );
      }

      cart.updateItemQuantity(productId, quantity);
      await carts.save(cart);
      return cart;
    });

    await this.eventPublisher.publish(cart.pullDomainEvents());
    return cart;
  }
}
