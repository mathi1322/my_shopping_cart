import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserRepository } from '@/infrastructure/repositories/DrizzleUserRepository';
import { User } from '@/domain/identity/User';
import { UserId } from '@/domain/identity/UserId';
import { Email } from '@/domain/identity/Email';
import { createTestDb, truncateAll } from '../setupDb';

const { db, client } = createTestDb();
const repository = new DrizzleUserRepository(db);

function makeUser(overrides: Partial<Parameters<typeof User.register>[0]> = {}) {
  return User.register({
    email: Email.fromString('seller@example.com'),
    passwordHash: 'somehash:somekey',
    role: 'seller',
    ...overrides,
  });
}

describe('DrizzleUserRepository', () => {
  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await client.end();
  });

  it('saves and retrieves a user by id', async () => {
    const user = makeUser();
    await repository.save(user);

    const found = await repository.findById(user.id);
    expect(found).not.toBeNull();
    expect(found?.email.toString()).toBe('seller@example.com');
    expect(found?.role).toBe('seller');
  });

  it('retrieves a user by email', async () => {
    const user = makeUser();
    await repository.save(user);

    const found = await repository.findByEmail(Email.fromString('seller@example.com'));
    expect(found?.id.toString()).toBe(user.id.toString());
  });

  it('returns null for an unknown id', async () => {
    expect(await repository.findById(UserId.create())).toBeNull();
  });

  it('returns null for an unknown email', async () => {
    expect(await repository.findByEmail(Email.fromString('nobody@example.com'))).toBeNull();
  });
});
