import type { Database } from './client';
import type { TransactionalRepositories, UnitOfWork } from '../../application/shared/UnitOfWork';
import { DrizzleCartRepository } from '../repositories/DrizzleCartRepository';
import { DrizzleOrderRepository } from '../repositories/DrizzleOrderRepository';
import { DrizzleProductRepository } from '../repositories/DrizzleProductRepository';

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        carts: new DrizzleCartRepository(tx),
        orders: new DrizzleOrderRepository(tx),
        products: new DrizzleProductRepository(tx),
      }),
    );
  }
}
