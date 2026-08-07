import { describe, expect, it } from 'vitest';
import { Order } from '@/domain/order/Order';
import { OrderItem } from '@/domain/order/OrderItem';
import { Quantity } from '@/domain/cart/Quantity';
import { ProductId } from '@/domain/product/ProductId';
import { VendorId } from '@/domain/product/VendorId';
import { Money } from '@/domain/shared/Money';
import { ValidationError, ForbiddenError, ConflictError } from '@/domain/shared/DomainError';
import { OrderPlaced, OrderCancelled } from '@/domain/order/OrderEvents';

function mkItem(overrides: Partial<{ quantity: Quantity; unitPrice: Money }> = {}) {
  return new OrderItem({
    productId: ProductId.create(),
    productName: 'Digital Infrared Thermometer',
    productImage: null,
    vendorId: VendorId.fromString('vendor-1'),
    unitPrice: overrides.unitPrice ?? Money.fromCents(89900),
    quantity: overrides.quantity ?? Quantity.of(1),
  });
}

function placeOrderInput(overrides: Record<string, unknown> = {}) {
  return {
    buyerId: 'buyer-1',
    buyerEmail: 'buyer@medikart.test',
    items: [mkItem()],
    deliveryAddress: '221B Baker Street',
    deliveryPhone: '9876543210',
    ...overrides,
  };
}

describe('Order', () => {
  it('places an order and records an OrderPlaced event', () => {
    const order = Order.place(placeOrderInput());

    expect(order.buyerId).toBe('buyer-1');
    expect(order.status).toBe('placed');
    expect(order.paymentMethod).toBe('cod');
    expect(order.items).toHaveLength(1);

    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderPlaced);
  });

  it('computes the total across items', () => {
    const order = Order.place(
      placeOrderInput({
        items: [
          mkItem({ unitPrice: Money.fromCents(89900), quantity: Quantity.of(2) }),
          mkItem({ unitPrice: Money.fromCents(129900), quantity: Quantity.of(1) }),
        ],
      }),
    );

    expect(order.total.cents).toBe(89900 * 2 + 129900);
  });

  it('rejects an order with no items', () => {
    expect(() => Order.place(placeOrderInput({ items: [] }))).toThrow(ValidationError);
  });

  it.each(['', '   '])('rejects a blank delivery address (%j)', (deliveryAddress) => {
    expect(() => Order.place(placeOrderInput({ deliveryAddress }))).toThrow(ValidationError);
  });

  it.each(['', '   '])('rejects a blank delivery phone (%j)', (deliveryPhone) => {
    expect(() => Order.place(placeOrderInput({ deliveryPhone }))).toThrow(ValidationError);
  });

  it('cancels an order owned by the requesting buyer and records an event', () => {
    const order = Order.place(placeOrderInput());
    order.pullDomainEvents();

    order.cancel('buyer-1');

    expect(order.status).toBe('cancelled');
    const events = order.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(OrderCancelled);
  });

  it('refuses to cancel an order that belongs to someone else', () => {
    const order = Order.place(placeOrderInput());
    expect(() => order.cancel('someone-else')).toThrow(ForbiddenError);
  });

  it('refuses to cancel an already-cancelled order', () => {
    const order = Order.place(placeOrderInput());
    order.cancel('buyer-1');
    expect(() => order.cancel('buyer-1')).toThrow(ConflictError);
  });
});
