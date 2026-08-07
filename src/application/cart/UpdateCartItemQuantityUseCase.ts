import { Cart } from '../../domain/cart/Cart';
import { Quantity } from '../../domain/cart/Quantity';
import { ProductId } from '../../domain/product/ProductId';
import { ConflictError, NotFoundError } from '../../domain/shared/DomainError';
import type { CartRepository } from '../../domain/cart/CartRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';

export interface UpdateCartItemQuantityInput {
  userId: string;
  productId: string;
  quantity: number;
}

export class UpdateCartItemQuantityUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: UpdateCartItemQuantityInput): Promise<Cart> {
    const cart = await this.cartRepository.findByUserId(input.userId);
    if (!cart) {
      throw new NotFoundError(`No cart found for user ${input.userId}`);
    }

    const productId = ProductId.fromString(input.productId);
    const quantity = Quantity.of(input.quantity);

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product ${input.productId} not found`);
    }
    if (!product.hasStockFor(quantity.value)) {
      throw new ConflictError(
        `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
      );
    }

    cart.updateItemQuantity(productId, quantity);

    await this.cartRepository.save(cart);
    await this.eventPublisher.publish(cart.pullDomainEvents());

    return cart;
  }
}
