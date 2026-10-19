import type { CartRepository } from '../../domain/cart/CartRepository';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';

export interface TransactionalRepositories {
  carts: CartRepository;
  orders: OrderRepository;
  products: ProductRepository;
}

/**
 * Runs `work` atomically: every write made through the given repositories
 * commits together, or — if `work` throws — none of them do.
 */
export interface UnitOfWork {
  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T>;
}
