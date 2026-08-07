import { AggregateRoot } from '../shared/AggregateRoot';
import { Money } from '../shared/Money';
import { NotFoundError } from '../shared/DomainError';
import { ProductId } from '../product/ProductId';
import { VendorId } from '../product/VendorId';
import { CartId } from './CartId';
import { CartItem } from './CartItem';
import { Quantity } from './Quantity';
import { CartItemAdded, CartItemQuantityChanged, CartItemRemoved } from './CartEvents';

export interface AddItemInput {
  productId: ProductId;
  productName: string;
  productImage?: string | null;
  vendorId: VendorId;
  unitPrice: Money;
  quantity: Quantity;
}

export interface CartProps {
  id: CartId;
  userId: string;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export class Cart extends AggregateRoot {
  private constructor(
    private readonly _id: CartId,
    private readonly _userId: string,
    private _items: CartItem[],
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(userId: string): Cart {
    const now = new Date();
    return new Cart(CartId.create(), userId, [], now, now);
  }

  /** Rebuilds a Cart from persisted state — bypasses creation events. */
  static reconstitute(props: CartProps): Cart {
    return new Cart(props.id, props.userId, props.items, props.createdAt, props.updatedAt);
  }

  get id(): CartId {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get items(): readonly CartItem[] {
    return this._items;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isEmpty(): boolean {
    return this._items.length === 0;
  }

  get total(): Money {
    return this._items.reduce((sum, item) => sum.add(item.subtotal), Money.zero());
  }

  findItem(productId: ProductId): CartItem | undefined {
    return this._items.find((item) => item.productId.equals(productId));
  }

  addItem(input: AddItemInput): void {
    const existing = this.findItem(input.productId);
    if (existing) {
      existing.increaseBy(input.quantity);
    } else {
      this._items.push(
        new CartItem({
          productId: input.productId,
          productName: input.productName,
          productImage: input.productImage ?? null,
          vendorId: input.vendorId,
          unitPrice: input.unitPrice,
          quantity: input.quantity,
        }),
      );
    }
    this._updatedAt = new Date();
    this.addDomainEvent(new CartItemAdded(this._id, input.productId, input.quantity));
  }

  updateItemQuantity(productId: ProductId, quantity: Quantity): void {
    const item = this.findItem(productId);
    if (!item) {
      throw new NotFoundError(`Product ${productId.toString()} is not in the cart`);
    }
    item.changeQuantity(quantity);
    this._updatedAt = new Date();
    this.addDomainEvent(new CartItemQuantityChanged(this._id, productId, quantity));
  }

  removeItem(productId: ProductId): void {
    const existing = this.findItem(productId);
    if (!existing) {
      throw new NotFoundError(`Product ${productId.toString()} is not in the cart`);
    }
    this._items = this._items.filter((item) => !item.productId.equals(productId));
    this._updatedAt = new Date();
    this.addDomainEvent(new CartItemRemoved(this._id, productId));
  }
}
