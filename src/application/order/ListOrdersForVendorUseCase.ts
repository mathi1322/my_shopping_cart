import { VendorId } from '../../domain/product/VendorId';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import { toOrderDto, type OrderDto } from './OrderDto';

export class ListOrdersForVendorUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  /** Returns each order with `items` narrowed to just this vendor's line items. */
  async execute(vendorId: string): Promise<OrderDto[]> {
    const orders = await this.orderRepository.findByVendorId(VendorId.fromString(vendorId));
    return orders.map((order) => {
      const dto = toOrderDto(order);
      return { ...dto, items: dto.items.filter((item) => item.vendorId === vendorId) };
    });
  }
}
