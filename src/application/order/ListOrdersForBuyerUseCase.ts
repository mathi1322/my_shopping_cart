import type { OrderRepository } from '../../domain/order/OrderRepository';
import { toOrderDto, type OrderDto } from './OrderDto';

export class ListOrdersForBuyerUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(buyerId: string): Promise<OrderDto[]> {
    const orders = await this.orderRepository.findByBuyerId(buyerId);
    return orders.map(toOrderDto);
  }
}
