import { beforeEach, describe, expect, it } from 'vitest';
import { ResolveSessionUseCase } from '@/application/identity/ResolveSessionUseCase';
import type { SessionStore } from '@/application/identity/SessionStore';
import { RegisterUserUseCase } from '@/application/identity/RegisterUserUseCase';
import { InMemoryUserRepository } from '../_fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../_fakes/FakePasswordHasher';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';

class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, string>();
  private nextId = 1;

  async create(userId: string): Promise<string> {
    const id = `session-${this.nextId++}`;
    this.sessions.set(id, userId);
    return id;
  }

  async resolve(sessionId: string): Promise<{ userId: string } | null> {
    const userId = this.sessions.get(sessionId);
    return userId ? { userId } : null;
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

describe('ResolveSessionUseCase', () => {
  let userRepository: InMemoryUserRepository;
  let sessionStore: InMemorySessionStore;
  let useCase: ResolveSessionUseCase;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    sessionStore = new InMemorySessionStore();
    useCase = new ResolveSessionUseCase(sessionStore, userRepository);
  });

  it('resolves a valid session to its user', async () => {
    const user = await new RegisterUserUseCase(
      userRepository,
      new FakePasswordHasher(),
      new RecordingEventPublisher(),
    ).execute({ email: 'a@example.com', password: 'password123', role: 'buyer' });

    const sessionId = await sessionStore.create(user.id);
    const resolved = await useCase.execute(sessionId);

    expect(resolved?.id).toBe(user.id);
  });

  it('returns null for an unknown session id', async () => {
    expect(await useCase.execute('nonexistent')).toBeNull();
  });

  it('returns null after the session has been destroyed', async () => {
    const user = await new RegisterUserUseCase(
      userRepository,
      new FakePasswordHasher(),
      new RecordingEventPublisher(),
    ).execute({ email: 'b@example.com', password: 'password123', role: 'seller' });

    const sessionId = await sessionStore.create(user.id);
    await sessionStore.destroy(sessionId);

    expect(await useCase.execute(sessionId)).toBeNull();
  });
});
