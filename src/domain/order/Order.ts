import { AggregateRoot } from '../shared/AggregateRoot';
import { Money } from '../shared/Money';
import { ValidationError, ForbiddenError, ConflictError } from '../shared/DomainError';
import { OrderId } from './OrderId';
import type { OrderItem } from './OrderItem';
import { OrderPlaced, OrderCancelled } from './OrderEvents';

export type OrderStatus = 'placed' | 'cancelled';
export type PaymentMethod = 'cod';

export interface OrderProps {
  id: OrderId;
  buyerId: string;
  buyerEmail: string;
  items: OrderItem[];
  deliveryAddress: string;
  deliveryPhone: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceOrderInput {
  buyerId: string;
  buyerEmail: string;
  items: OrderItem[];
  deliveryAddress: string;
  deliveryPhone: string;
}

const MAX_ADDRESS_LENGTH = 500;
const MAX_PHONE_LENGTH = 20;

export class Order extends AggregateRoot {
  private constructor(private props: OrderProps) {
    super();
  }

  static place(input: PlaceOrderInput): Order {
    if (input.items.length === 0) {
      throw new ValidationError('An order must contain at least one item');
    }
    Order.assertAddress(input.deliveryAddress);
    Order.assertPhone(input.deliveryPhone);

    const now = new Date();
    const order = new Order({
      id: OrderId.create(),
      buyerId: input.buyerId,
      buyerEmail: input.buyerEmail,
      items: input.items,
      deliveryAddress: input.deliveryAddress.trim(),
      deliveryPhone: input.deliveryPhone.trim(),
      paymentMethod: 'cod',
      status: 'placed',
      createdAt: now,
      updatedAt: now,
    });
    order.addDomainEvent(new OrderPlaced(order.id, order.buyerId));
    return order;
  }

  /** Rebuilds an Order from persisted state — bypasses placement invariants/events. */
  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  cancel(requestingUserId: string): void {
    if (this.props.buyerId !== requestingUserId) {
      throw new ForbiddenError('You do not own this order');
    }
    if (this.props.status === 'cancelled') {
      throw new ConflictError('This order has already been cancelled');
    }
    this.props.status = 'cancelled';
    this.props.updatedAt = new Date();
    this.addDomainEvent(new OrderCancelled(this.id));
  }

  get id(): OrderId {
    return this.props.id;
  }

  get buyerId(): string {
    return this.props.buyerId;
  }

  get buyerEmail(): string {
    return this.props.buyerEmail;
  }

  get items(): readonly OrderItem[] {
    return this.props.items;
  }

  get deliveryAddress(): string {
    return this.props.deliveryAddress;
  }

  get deliveryPhone(): string {
    return this.props.deliveryPhone;
  }

  get paymentMethod(): PaymentMethod {
    return this.props.paymentMethod;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get total(): Money {
    return this.props.items.reduce((sum, item) => sum.add(item.subtotal), Money.zero());
  }

  private static assertAddress(address: string): void {
    if (!address || address.trim().length === 0) {
      throw new ValidationError('Delivery address is required');
    }
    if (address.trim().length > MAX_ADDRESS_LENGTH) {
      throw new ValidationError(`Delivery address cannot exceed ${MAX_ADDRESS_LENGTH} characters`);
    }
  }

  private static assertPhone(phone: string): void {
    if (!phone || phone.trim().length === 0) {
      throw new ValidationError('Delivery phone number is required');
    }
    if (phone.trim().length > MAX_PHONE_LENGTH) {
      throw new ValidationError(
        `Delivery phone number cannot exceed ${MAX_PHONE_LENGTH} characters`,
      );
    }
  }
}
