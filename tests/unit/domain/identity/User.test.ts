import { describe, expect, it } from 'vitest';
import { User } from '@/domain/identity/User';
import { Email } from '@/domain/identity/Email';
import { UserRegistered } from '@/domain/identity/UserEvents';
import { FakePasswordHasher } from '../../application/_fakes/FakePasswordHasher';

describe('User', () => {
  const hasher = new FakePasswordHasher();

  it('registers a user and records a UserRegistered event', async () => {
    const passwordHash = await hasher.hash('correct-horse');
    const user = User.register({
      email: Email.fromString('seller@example.com'),
      passwordHash,
      role: 'seller',
    });

    expect(user.email.toString()).toBe('seller@example.com');
    expect(user.role).toBe('seller');
    expect(user.isSeller()).toBe(true);

    const events = user.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(UserRegistered);
  });

  it('verifies a correct password against the stored hash', async () => {
    const passwordHash = await hasher.hash('correct-horse');
    const user = User.register({
      email: Email.fromString('a@example.com'),
      passwordHash,
      role: 'buyer',
    });

    expect(await user.verifyPassword('correct-horse', hasher)).toBe(true);
    expect(await user.verifyPassword('wrong-password', hasher)).toBe(false);
  });

  it('isSeller() is false for a buyer', async () => {
    const passwordHash = await hasher.hash('whatever123');
    const user = User.register({
      email: Email.fromString('b@example.com'),
      passwordHash,
      role: 'buyer',
    });
    expect(user.isSeller()).toBe(false);
  });
});
