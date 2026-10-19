import { VendorId } from '../../domain/product/VendorId';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import { pageInfo, resolvePage, type PageQuery, type Paged } from '../shared/Paging';
import { toVendorOrderDto, type OrderDto } from './OrderDto';
import { ORDERS_PAGE_SIZE } from './ListOrdersForBuyerUseCase';

export class ListOrdersForVendorUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  /**
   * Each order narrowed to this vendor's line items, with `status` describing
   * just those items — what this seller still has to ship or deliver.
   */
  async execute(
    vendorIdValue: string,
    query: PageQuery = {},
  ): Promise<{ orders: OrderDto[]; awaitingShipmentCount: number } & Paged> {
    const vendorId = VendorId.fromString(vendorIdValue);
    const { page, pageSize, request } = resolvePage(query, {
      pageSize: ORDERS_PAGE_SIZE,
      maxPageSize: 50,
    });
    const [result, awaitingShipmentCount] = await Promise.all([
      this.orderRepository.findPageByVendorId(vendorId, request),
      this.orderRepository.countAwaitingShipment(vendorId),
    ]);

    const orders = result.items.map((order) => toVendorOrderDto(order, vendorId));
    return { orders, awaitingShipmentCount, ...pageInfo(result.total, page, pageSize) };
  }
}
