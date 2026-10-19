import type { DomainEvent } from '../shared/DomainEvent';
import type { OrderId } from './OrderId';
import type { VendorId } from '../product/VendorId';
import type { FulfillmentStatus } from './OrderItem';

export class OrderPlaced implements DomainEvent {
  readonly name = 'order.placed';
  readonly occurredAt = new Date();

  constructor(
    readonly orderId: OrderId,
    readonly buyerId: string,
  ) {}
}

export class OrderCancelled implements DomainEvent {
  readonly name = 'order.cancelled';
  readonly occurredAt = new Date();

  constructor(readonly orderId: OrderId) {}
}

/** A seller moved their items in an order forward (shipped or delivered). */
export class OrderFulfillmentAdvanced implements DomainEvent {
  readonly name = 'order.fulfillment_advanced';
  readonly occurredAt = new Date();

  constructor(
    readonly orderId: OrderId,
    readonly vendorId: VendorId,
    readonly status: FulfillmentStatus,
  ) {}
}
