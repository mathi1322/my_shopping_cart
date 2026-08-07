import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSessionStore } from '@/infrastructure/auth/DrizzleSessionStore';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';

const { db, client } = createTestDb();
const sessionStore = new DrizzleSessionStore(db);

describe('DrizzleSessionStore', () => {
  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await client.end();
  });

  it('creates a session that resolves back to the same user', async () => {
    const user = await seedTestUser(db, 'buyer');

    const sessionId = await sessionStore.create(user.id);
    const resolved = await sessionStore.resolve(sessionId);

    expect(resolved?.userId).toBe(user.id);
  });

  it('returns null for an unknown session id', async () => {
    expect(await sessionStore.resolve('does-not-exist')).toBeNull();
  });

  it('returns null after the session is destroyed', async () => {
    const user = await seedTestUser(db, 'buyer');
    const sessionId = await sessionStore.create(user.id);

    await sessionStore.destroy(sessionId);

    expect(await sessionStore.resolve(sessionId)).toBeNull();
  });
});
