import { Money } from '../shared/Money';
import { ProductId } from '../product/ProductId';
import { VendorId } from '../product/VendorId';
import { Quantity } from './Quantity';

export interface CartItemProps {
  productId: ProductId;
  productName: string;
  productImage: string | null;
  vendorId: VendorId;
  unitPrice: Money;
  quantity: Quantity;
}

/**
 * Product name and price are snapshotted at add-to-cart time so the cart
 * total doesn't silently drift if a vendor edits a product afterwards.
 */
export class CartItem {
  constructor(private props: CartItemProps) {}

  get productId(): ProductId {
    return this.props.productId;
  }

  get productName(): string {
    return this.props.productName;
  }

  get productImage(): string | null {
    return this.props.productImage;
  }

  get vendorId(): VendorId {
    return this.props.vendorId;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get quantity(): Quantity {
    return this.props.quantity;
  }

  get subtotal(): Money {
    return this.props.unitPrice.multiply(this.props.quantity.value);
  }

  changeQuantity(quantity: Quantity): void {
    this.props.quantity = quantity;
  }

  increaseBy(quantity: Quantity): void {
    this.props.quantity = this.props.quantity.plus(quantity);
  }
}
