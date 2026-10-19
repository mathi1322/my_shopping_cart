import type { TransactionalRepositories, UnitOfWork } from '@/application/shared/UnitOfWork';

/**
 * Passes the same in-memory repositories straight through. It does not roll
 * back on failure, so tests relying on rollback belong in the integration suite.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repositories: TransactionalRepositories) {}

  async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    return work(this.repositories);
  }
}
