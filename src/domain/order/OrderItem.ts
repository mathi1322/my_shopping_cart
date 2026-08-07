import { Money } from '../shared/Money';
import { ProductId } from '../product/ProductId';
import { VendorId } from '../product/VendorId';
import { Quantity } from '../cart/Quantity';

export interface OrderItemProps {
  productId: ProductId;
  productName: string;
  productImage: string | null;
  vendorId: VendorId;
  unitPrice: Money;
  quantity: Quantity;
}

/** Snapshotted at order placement time — never drifts if the product changes afterwards. */
export class OrderItem {
  constructor(private readonly props: OrderItemProps) {}

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
}
