import { OrderId } from '../../domain/order/OrderId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { DomainEvent } from '../../domain/shared/DomainEvent';
import { toOrderDto, type OrderDto } from './OrderDto';

export interface CancelOrderInput {
  orderId: string;
  requestingUserId: string;
}

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: CancelOrderInput): Promise<OrderDto> {
    const order = await this.orderRepository.findById(OrderId.fromString(input.orderId));
    if (!order) {
      throw new NotFoundError(`Order ${input.orderId} not found`);
    }

    order.cancel(input.requestingUserId);

    const events: DomainEvent[] = [];

    for (const item of order.items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        product.updateDetails({ stockQuantity: product.stockQuantity + item.quantity.value });
        await this.productRepository.save(product);
        events.push(...product.pullDomainEvents());
      }
    }

    await this.orderRepository.save(order);
    events.push(...order.pullDomainEvents());

    await this.eventPublisher.publish(events);

    return toOrderDto(order);
  }
}
