import type { Order, OrderStatus, PaymentMethod } from '../../domain/order/Order';

export interface OrderItemDto {
  productId: string;
  productName: string;
  productImage: string | null;
  vendorId: string;
  unitPriceInCents: number;
  quantity: number;
  subtotalInCents: number;
}

export interface OrderDto {
  id: string;
  buyerId: string;
  buyerEmail: string;
  items: OrderItemDto[];
  deliveryAddress: string;
  deliveryPhone: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  totalInCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id.toString(),
    buyerId: order.buyerId,
    buyerEmail: order.buyerEmail,
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      productName: item.productName,
      productImage: item.productImage,
      vendorId: item.vendorId.toString(),
      unitPriceInCents: item.unitPrice.cents,
      quantity: item.quantity.value,
      subtotalInCents: item.subtotal.cents,
    })),
    deliveryAddress: order.deliveryAddress,
    deliveryPhone: order.deliveryPhone,
    paymentMethod: order.paymentMethod,
    status: order.status,
    totalInCents: order.total.cents,
    currency: order.total.currencyCode,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
