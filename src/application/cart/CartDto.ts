import type { Cart } from '../../domain/cart/Cart';
import { nameFor, type VendorDirectory } from '../shared/VendorDirectory';

export interface CartItemDto {
  productId: string;
  productName: string;
  productImage: string | null;
  vendorId: string;
  vendorName: string;
  unitPriceInCents: number;
  quantity: number;
  subtotalInCents: number;
}

export interface CartDto {
  id: string;
  items: CartItemDto[];
  totalInCents: number;
  currency: string;
  updatedAt: string;
}

export function toCartDto(cart: Cart, vendorNames: Map<string, string> = new Map()): CartDto {
  return {
    id: cart.id.toString(),
    items: cart.items.map((item) => ({
      productId: item.productId.toString(),
      productName: item.productName,
      productImage: item.productImage,
      vendorId: item.vendorId.toString(),
      vendorName: nameFor(vendorNames, item.vendorId.toString()),
      unitPriceInCents: item.unitPrice.cents,
      quantity: item.quantity.value,
      subtotalInCents: item.subtotal.cents,
    })),
    totalInCents: cart.total.cents,
    currency: cart.total.currencyCode,
    updatedAt: cart.updatedAt.toISOString(),
  };
}

/** toCartDto with each item's seller display name filled in. */
export async function presentCart(cart: Cart, vendorDirectory: VendorDirectory): Promise<CartDto> {
  const names = await vendorDirectory.displayNames(
    cart.items.map((item) => item.vendorId.toString()),
  );
  return toCartDto(cart, names);
}
