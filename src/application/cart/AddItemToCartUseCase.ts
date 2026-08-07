import { Cart } from '../../domain/cart/Cart';
import { Quantity } from '../../domain/cart/Quantity';
import { ProductId } from '../../domain/product/ProductId';
import { ConflictError, NotFoundError } from '../../domain/shared/DomainError';
import type { CartRepository } from '../../domain/cart/CartRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { GetOrCreateCartUseCase } from './GetOrCreateCartUseCase';

export interface AddItemToCartInput {
  cartId?: string;
  productId: string;
  quantity: number;
}

export class AddItemToCartUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
    private readonly getOrCreateCart: GetOrCreateCartUseCase,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: AddItemToCartInput): Promise<Cart> {
    const cart = await this.getOrCreateCart.execute(input.cartId);
    const product = await this.productRepository.findById(ProductId.fromString(input.productId));
    if (!product) {
      throw new NotFoundError(`Product ${input.productId} not found`);
    }

    const requestedQuantity = Quantity.of(input.quantity);
    const existingQuantity = cart.findItem(product.id)?.quantity.value ?? 0;
    const totalRequested = existingQuantity + requestedQuantity.value;

    if (!product.hasStockFor(totalRequested)) {
      throw new ConflictError(
        `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
      );
    }

    cart.addItem({
      productId: product.id,
      productName: product.name,
      vendorId: product.vendorId,
      unitPrice: product.price,
      quantity: requestedQuantity,
    });

    await this.cartRepository.save(cart);
    await this.eventPublisher.publish(cart.pullDomainEvents());

    return cart;
  }
}
