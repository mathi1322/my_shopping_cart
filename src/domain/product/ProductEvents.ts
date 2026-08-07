import type { DomainEvent } from '../shared/DomainEvent';
import type { ProductId } from './ProductId';
import type { VendorId } from './VendorId';

export class ProductCreated implements DomainEvent {
  readonly name = 'product.created';
  readonly occurredAt = new Date();

  constructor(
    readonly productId: ProductId,
    readonly vendorId: VendorId,
  ) {}
}

export class ProductUpdated implements DomainEvent {
  readonly name = 'product.updated';
  readonly occurredAt = new Date();

  constructor(readonly productId: ProductId) {}
}

export class ProductDeleted implements DomainEvent {
  readonly name = 'product.deleted';
  readonly occurredAt = new Date();

  constructor(
    readonly productId: ProductId,
    readonly vendorId: VendorId,
  ) {}
}
