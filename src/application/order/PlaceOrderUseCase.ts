import { Order } from '../../domain/order/Order';
import { OrderItem } from '../../domain/order/OrderItem';
import { ConflictError } from '../../domain/shared/DomainError';
import type { Cart } from '../../domain/cart/Cart';
import type { CartRepository } from '../../domain/cart/CartRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { DomainEvent } from '../../domain/shared/DomainEvent';
import type { TransactionalRepositories, UnitOfWork } from '../shared/UnitOfWork';
import { toOrderDto, type OrderDto } from './OrderDto';

export interface PlaceOrderInput {
  buyerId: string;
  buyerEmail: string;
  deliveryAddress: string;
  deliveryPhone: string;
}

/** Thrown inside the transaction to abort it; the repriced cart is saved afterwards. */
class CartRepriced extends Error {
  constructor(
    readonly cart: Cart,
    readonly productNames: string[],
  ) {
    super('Cart prices are out of date');
  }
}

export class PlaceOrderUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly cartRepository: CartRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: PlaceOrderInput): Promise<OrderDto> {
    let order: Order;
    let events: DomainEvent[];
    try {
      ({ order, events } = await this.unitOfWork.run((repositories) =>
        this.placeInTransaction(input, repositories),
      ));
    } catch (error) {
      if (!(error instanceof CartRepriced)) {
        throw error;
      }
      await this.cartRepository.save(error.cart);
      await this.eventPublisher.publish(error.cart.pullDomainEvents());
      const names = error.productNames.map((name) => `"${name}"`).join(', ');
      throw new ConflictError(
        `The price of ${names} has changed. Please review your cart before placing the order.`,
      );
    }

    await this.eventPublisher.publish(events);
    return toOrderDto(order);
  }

  private async placeInTransaction(
    input: PlaceOrderInput,
    { carts, orders, products }: TransactionalRepositories,
  ): Promise<{ order: Order; events: DomainEvent[] }> {
    // Locking the cart serialises concurrent checkouts by the same buyer (e.g. a double-click):
    // the second one waits, then finds the cart already empty.
    const cart = await carts.findByUserIdForUpdate(input.buyerId);
    if (!cart || cart.isEmpty) {
      throw new ConflictError('Your cart is empty');
    }

    // Lock products in a consistent order so two checkouts sharing products can't deadlock.
    const items = [...cart.items].sort((a, b) =>
      a.productId.toString().localeCompare(b.productId.toString()),
    );

    // With the rows locked, stock and price can't change under us until commit.
    const repricedNames: string[] = [];
    for (const item of items) {
      const product = await products.findByIdForUpdate(item.productId);
      if (!product || !product.hasStockFor(item.quantity.value)) {
        const available = product?.stockQuantity ?? 0;
        throw new ConflictError(`Only ${available} unit(s) of "${item.productName}" are available`);
      }
      if (!product.price.equals(item.unitPrice)) {
        cart.repriceItem(item.productId, product.price);
        repricedNames.push(item.productName);
      }
    }
    if (repricedNames.length > 0) {
      throw new CartRepriced(cart, repricedNames);
    }

    for (const item of items) {
      const reserved = await products.decrementStock(item.productId, item.quantity.value);
      if (!reserved) {
        throw new ConflictError(`"${item.productName}" just sold out`);
      }
    }

    const order = Order.place({
      buyerId: input.buyerId,
      buyerEmail: input.buyerEmail,
      items: cart.items.map(
        (item) =>
          new OrderItem({
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            vendorId: item.vendorId,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          }),
      ),
      deliveryAddress: input.deliveryAddress,
      deliveryPhone: input.deliveryPhone,
    });

    cart.clear();
    await carts.save(cart);
    await orders.save(order);

    return { order, events: [...cart.pullDomainEvents(), ...order.pullDomainEvents()] };
  }
}
