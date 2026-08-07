import type { DomainEvent } from '../shared/DomainEvent';
import type { OrderId } from './OrderId';

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
