import { Order } from '../../domain/order/Order';
import { OrderItem } from '../../domain/order/OrderItem';
import { ConflictError } from '../../domain/shared/DomainError';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { CartRepository } from '../../domain/cart/CartRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { DomainEvent } from '../../domain/shared/DomainEvent';
import { toOrderDto, type OrderDto } from './OrderDto';

export interface PlaceOrderInput {
  buyerId: string;
  buyerEmail: string;
  deliveryAddress: string;
  deliveryPhone: string;
}

export class PlaceOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly cartRepository: CartRepository,
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: PlaceOrderInput): Promise<OrderDto> {
    const cart = await this.cartRepository.findByUserId(input.buyerId);
    if (!cart || cart.isEmpty) {
      throw new ConflictError('Your cart is empty');
    }

    // Re-check stock at order time — it may have changed since items were added to the cart.
    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId);
      if (!product || !product.hasStockFor(item.quantity.value)) {
        const available = product?.stockQuantity ?? 0;
        throw new ConflictError(`Only ${available} unit(s) of "${item.productName}" are available`);
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

    const events: DomainEvent[] = [];

    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        product.updateDetails({ stockQuantity: product.stockQuantity - item.quantity.value });
        await this.productRepository.save(product);
        events.push(...product.pullDomainEvents());
      }
    }

    cart.clear();
    await this.cartRepository.save(cart);
    events.push(...cart.pullDomainEvents());

    await this.orderRepository.save(order);
    events.push(...order.pullDomainEvents());

    await this.eventPublisher.publish(events);

    return toOrderDto(order);
  }
}
