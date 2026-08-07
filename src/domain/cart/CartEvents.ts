import type { DomainEvent } from '../shared/DomainEvent';
import type { CartId } from './CartId';
import type { ProductId } from '../product/ProductId';
import type { Quantity } from './Quantity';

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

export class CartItemRemoved implements DomainEvent {
  readonly name = 'cart.item_removed';
  readonly occurredAt = new Date();

  constructor(
    readonly cartId: CartId,
    readonly productId: ProductId,
  ) {}
}
