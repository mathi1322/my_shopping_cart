import { describe, expect, it } from 'vitest';
import { Cart } from '@/domain/cart/Cart';
import { Quantity } from '@/domain/cart/Quantity';
import { ProductId } from '@/domain/product/ProductId';
import { VendorId } from '@/domain/product/VendorId';
import { Money } from '@/domain/shared/Money';
import { NotFoundError } from '@/domain/shared/DomainError';
import { CartItemAdded, CartItemQuantityChanged, CartItemRemoved } from '@/domain/cart/CartEvents';

function addItemInput(overrides: Partial<{ productId: ProductId; quantity: Quantity }> = {}) {
  return {
    productId: overrides.productId ?? ProductId.create(),
    productName: 'Wireless Mouse',
    vendorId: VendorId.fromString('vendor-1'),
    unitPrice: Money.fromCents(1999),
    quantity: overrides.quantity ?? Quantity.of(1),
  };
}

describe('Cart', () => {
  it('starts empty with a zero total', () => {
    const cart = Cart.create('buyer-1');
    expect(cart.isEmpty).toBe(true);
    expect(cart.total.cents).toBe(0);
  });

  it('adds a new line item and records a CartItemAdded event', () => {
    const cart = Cart.create('buyer-1');
    const productId = ProductId.create();

    cart.addItem(addItemInput({ productId, quantity: Quantity.of(2) }));

    expect(cart.isEmpty).toBe(false);
    expect(cart.findItem(productId)?.quantity.value).toBe(2);
    expect(cart.total.cents).toBe(3998);

    const events = cart.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(CartItemAdded);
  });

  it('merges quantities when the same product is added twice', () => {
    const cart = Cart.create('buyer-1');
    const productId = ProductId.create();

    cart.addItem(addItemInput({ productId, quantity: Quantity.of(2) }));
    cart.addItem(addItemInput({ productId, quantity: Quantity.of(3) }));

    expect(cart.items).toHaveLength(1);
    expect(cart.findItem(productId)?.quantity.value).toBe(5);
  });

  it('sums subtotals across distinct products for the cart total', () => {
    const cart = Cart.create('buyer-1');
    cart.addItem(addItemInput({ quantity: Quantity.of(1) })); // 1999
    cart.addItem(addItemInput({ quantity: Quantity.of(2) })); // 3998

    expect(cart.total.cents).toBe(1999 + 3998);
  });

  it('updates the quantity of an existing item and records an event', () => {
    const cart = Cart.create('buyer-1');
    const productId = ProductId.create();
    cart.addItem(addItemInput({ productId, quantity: Quantity.of(1) }));
    cart.pullDomainEvents();

    cart.updateItemQuantity(productId, Quantity.of(9));

    expect(cart.findItem(productId)?.quantity.value).toBe(9);
    expect(cart.pullDomainEvents()[0]).toBeInstanceOf(CartItemQuantityChanged);
  });

  it('throws NotFoundError when updating a product that is not in the cart', () => {
    const cart = Cart.create('buyer-1');
    expect(() => cart.updateItemQuantity(ProductId.create(), Quantity.of(1))).toThrow(
      NotFoundError,
    );
  });

  it('removes an item and records a CartItemRemoved event', () => {
    const cart = Cart.create('buyer-1');
    const productId = ProductId.create();
    cart.addItem(addItemInput({ productId }));
    cart.pullDomainEvents();

    cart.removeItem(productId);

    expect(cart.isEmpty).toBe(true);
    expect(cart.pullDomainEvents()[0]).toBeInstanceOf(CartItemRemoved);
  });

  it('throws NotFoundError when removing a product that is not in the cart', () => {
    const cart = Cart.create('buyer-1');
    expect(() => cart.removeItem(ProductId.create())).toThrow(NotFoundError);
  });
});
