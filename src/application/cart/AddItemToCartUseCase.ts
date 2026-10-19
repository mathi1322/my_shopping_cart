import { Cart } from '../../domain/cart/Cart';
import { Quantity } from '../../domain/cart/Quantity';
import { ProductId } from '../../domain/product/ProductId';
import { ConflictError, NotFoundError } from '../../domain/shared/DomainError';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { UnitOfWork } from '../shared/UnitOfWork';

export interface AddItemToCartInput {
  userId: string;
  productId: string;
  quantity: number;
}

export class AddItemToCartUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: AddItemToCartInput): Promise<Cart> {
    const cart = await this.unitOfWork.run(async ({ carts, products }) => {
      // Lock the cart so concurrent adds (e.g. a double-click) can't overwrite each other.
      await carts.createIfAbsent(Cart.create(input.userId));
      const cart = (await carts.findByUserIdForUpdate(input.userId))!;

      const product = await products.findById(ProductId.fromString(input.productId));
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
        productImage: product.images[0] ?? null,
        vendorId: product.vendorId,
        unitPrice: product.price,
        quantity: requestedQuantity,
      });

      await carts.save(cart);
      return cart;
    });

    await this.eventPublisher.publish(cart.pullDomainEvents());
    return cart;
  }
}
