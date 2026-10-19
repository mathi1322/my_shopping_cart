import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { VendorDirectory } from '../shared/VendorDirectory';
import { pageInfo, resolvePage, type PageQuery, type Paged } from '../shared/Paging';
import { toOrderDto, vendorIdsIn, type OrderDto } from './OrderDto';

export const ORDERS_PAGE_SIZE = 10;

export class ListOrdersForBuyerUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly vendorDirectory: VendorDirectory,
  ) {}

  async execute(buyerId: string, query: PageQuery = {}): Promise<{ orders: OrderDto[] } & Paged> {
    const { page, pageSize, request } = resolvePage(query, {
      pageSize: ORDERS_PAGE_SIZE,
      maxPageSize: 50,
    });
    const result = await this.orderRepository.findPageByBuyerId(buyerId, request);
    const names = await this.vendorDirectory.displayNames(vendorIdsIn(result.items));
    return {
      orders: result.items.map((order) => toOrderDto(order, names)),
      ...pageInfo(result.total, page, pageSize),
    };
  }
}
