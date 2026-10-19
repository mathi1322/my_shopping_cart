import type { DomainEvent } from '../shared/DomainEvent';
import type { CartId } from './CartId';
import type { ProductId } from '../product/ProductId';
import type { Quantity } from './Quantity';
import type { Money } from '../shared/Money';

export class CartItemAdded implements DomainEvent {
  readonly name = 'cart.item_added';
  readonly occurredAt = new Date();

  constructor(
    readonly cartId: CartId,
    readonly productId: ProductId,
    readonly quantity: Quantity,
  ) {}
}

export class CartItemQuantityChanged implements DomainEvent {
  readonly name = 'cart.item_quantity_changed';
  readonly occurredAt = new Date();

  constructor(
    readonly cartId: CartId,
    readonly productId: ProductId,
    readonly quantity: Quantity,
  ) {}
}

export class CartItemRepriced implements DomainEvent {
  readonly name = 'cart.item_repriced';
  readonly occurredAt = new Date();

  constructor(
    readonly cartId: CartId,
    readonly productId: ProductId,
    readonly unitPrice: Money,
  ) {}
}

export class CartItemRemoved implements DomainEvent {
  readonly name = 'cart.item_removed';
  readonly occurredAt = new Date();

  constructor(
    readonly cartId: CartId,
    readonly productId: ProductId,
  ) {}
}

export class CartCleared implements DomainEvent {
  readonly name = 'cart.cleared';
  readonly occurredAt = new Date();

  constructor(readonly cartId: CartId) {}
}
