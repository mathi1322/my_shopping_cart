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

  it('persists profile updates on an existing user (upsert, not insert-only)', async () => {
    const user = makeUser();
    await repository.save(user);

    user.updateProfile({
      name: 'Priya Seller',
      phone: '9876543210',
      address: '221B Baker Street',
      companyName: 'Priya Medical Supplies',
      companyAddress: 'Unit 4, Industrial Estate',
      gstNumber: '22AAAAA0000A1Z5',
    });
    await repository.save(user);

    const found = await repository.findById(user.id);
    expect(found?.name).toBe('Priya Seller');
    expect(found?.phone).toBe('9876543210');
    expect(found?.address).toBe('221B Baker Street');
    expect(found?.companyName).toBe('Priya Medical Supplies');
    expect(found?.companyAddress).toBe('Unit 4, Industrial Estate');
    expect(found?.gstNumber).toBe('22AAAAA0000A1Z5');
    expect(found?.email.toString()).toBe('seller@example.com');
  });
});
