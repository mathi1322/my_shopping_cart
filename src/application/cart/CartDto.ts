import type { Cart } from '../../domain/cart/Cart';

export interface CartItemDto {
  productId: string;
  productName: string;
  productImage: string | null;
  vendorId: string;
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

export function toCartDto(cart: Cart): CartDto {
  return {
    id: cart.id.toString(),
    items: cart.items.map((item) => ({
      productId: item.productId.toString(),
      productName: item.productName,
      productImage: item.productImage,
      vendorId: item.vendorId.toString(),
      unitPriceInCents: item.unitPrice.cents,
      quantity: item.quantity.value,
      subtotalInCents: item.subtotal.cents,
    })),
    totalInCents: cart.total.cents,
    currency: cart.total.currencyCode,
    updatedAt: cart.updatedAt.toISOString(),
  };
}
