import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/infrastructure/db/schema';
import { DrizzleUserRepository } from '@/infrastructure/repositories/DrizzleUserRepository';
import { ScryptPasswordHasher } from '@/infrastructure/auth/ScryptPasswordHasher';
import { RegisterUserUseCase } from '@/application/identity/RegisterUserUseCase';
import type { DomainEventPublisher } from '@/application/shared/DomainEventPublisher';
import type { UserDto } from '@/application/identity/UserDto';
import type { UserRole } from '@/domain/identity/User';

const noopEventPublisher: DomainEventPublisher = { publish: async () => {} };

export function createTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set to run integration tests');
  }
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function truncateAll(db: ReturnType<typeof createTestDb>['db']): Promise<void> {
  await db.execute(
    'TRUNCATE TABLE cart_items, carts, products, sessions, users RESTART IDENTITY CASCADE',
  );
}

let userCounter = 0;

/** Registers a real user row (via the real use case + hasher) for tests that need a valid FK owner. */
export async function seedTestUser(
  db: ReturnType<typeof createTestDb>['db'],
  role: UserRole = 'seller',
): Promise<UserDto> {
  userCounter += 1;
  const registerUser = new RegisterUserUseCase(
    new DrizzleUserRepository(db),
    new ScryptPasswordHasher(),
    noopEventPublisher,
  );
  return registerUser.execute({
    email: `test-user-${userCounter}@example.com`,
    password: 'password123',
    role,
  });
}
