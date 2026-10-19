import { OrderId } from '../../domain/order/OrderId';
import { VendorId } from '../../domain/product/VendorId';
import { ForbiddenError, NotFoundError } from '../../domain/shared/DomainError';
import type { FulfillmentStatus } from '../../domain/order/OrderItem';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { RequestingUser } from '../shared/RequestingUser';
import type { UnitOfWork } from '../shared/UnitOfWork';
import { toVendorOrderDto, type OrderDto } from './OrderDto';

export interface AdvanceOrderFulfillmentInput {
  orderId: string;
  status: Exclude<FulfillmentStatus, 'placed'>;
}

/** A seller marks their items in an order as shipped, then delivered. */
export class AdvanceOrderFulfillmentUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: AdvanceOrderFulfillmentInput, seller: RequestingUser): Promise<OrderDto> {
    if (seller.role !== 'seller') {
      throw new ForbiddenError('Only sellers can update order status');
    }
    const vendorId = VendorId.fromString(seller.id);

    const order = await this.unitOfWork.run(async ({ orders }) => {
      // Locked so a concurrent buyer cancel and seller update can't interleave.
      const order = await orders.findByIdForUpdate(OrderId.fromString(input.orderId));
      if (!order) {
        throw new NotFoundError(`Order ${input.orderId} not found`);
      }
      order.advanceFulfillment(vendorId, input.status);
      await orders.save(order);
      return order;
    });

    await this.eventPublisher.publish(order.pullDomainEvents());
    return toVendorOrderDto(order, vendorId);
  }
}
