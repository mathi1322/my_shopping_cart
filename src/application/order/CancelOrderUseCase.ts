import { OrderId } from '../../domain/order/OrderId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { UnitOfWork } from '../shared/UnitOfWork';
import { toOrderDto, type OrderDto } from './OrderDto';

export interface CancelOrderInput {
  orderId: string;
  requestingUserId: string;
}

export class CancelOrderUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: CancelOrderInput): Promise<OrderDto> {
    const order = await this.unitOfWork.run(async ({ orders, products }) => {
      // The row lock makes a concurrent second cancel wait, then fail the
      // already-cancelled check, so stock is only ever restored once.
      const order = await orders.findByIdForUpdate(OrderId.fromString(input.orderId));
      if (!order) {
        throw new NotFoundError(`Order ${input.orderId} not found`);
      }

      order.cancel(input.requestingUserId);

      for (const item of order.items) {
        await products.incrementStock(item.productId, item.quantity.value);
      }
      await orders.save(order);
      return order;
    });

    await this.eventPublisher.publish(order.pullDomainEvents());
    return toOrderDto(order);
  }
}
