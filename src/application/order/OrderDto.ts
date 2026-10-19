import type { Order, OrderStatus, PaymentMethod } from '../../domain/order/Order';
import type { FulfillmentStatus } from '../../domain/order/OrderItem';
import type { VendorId } from '../../domain/product/VendorId';
import { nameFor } from '../shared/VendorDirectory';

export interface OrderItemDto {
  productId: string;
  productName: string;
  productImage: string | null;
  vendorId: string;
  vendorName: string;
  unitPriceInCents: number;
  quantity: number;
  subtotalInCents: number;
  fulfillmentStatus: FulfillmentStatus;
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

export function toOrderDto(order: Order, vendorNames: Map<string, string> = new Map()): OrderDto {
  return {
    id: order.id.toString(),
    buyerId: order.buyerId,
    buyerEmail: order.buyerEmail,
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      productName: item.productName,
      productImage: item.productImage,
      vendorId: item.vendorId.toString(),
      vendorName: nameFor(vendorNames, item.vendorId.toString()),
      unitPriceInCents: item.unitPrice.cents,
      quantity: item.quantity.value,
      subtotalInCents: item.subtotal.cents,
      fulfillmentStatus: item.fulfillmentStatus,
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

export function vendorIdsIn(orders: readonly Order[]): string[] {
  return orders.flatMap((order) => order.items.map((item) => item.vendorId.toString()));
}

/** A seller's view of an order: only their items, with status and total for just those. */
export function toVendorOrderDto(order: Order, vendorId: VendorId): OrderDto {
  const dto = toOrderDto(order);
  const items = dto.items.filter((item) => item.vendorId === vendorId.toString());
  return {
    ...dto,
    items,
    status: order.statusFor(vendorId),
    totalInCents: items.reduce((sum, item) => sum + item.subtotalInCents, 0),
  };
}
