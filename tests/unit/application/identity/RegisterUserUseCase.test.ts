import { beforeEach, describe, expect, it } from 'vitest';
import { RegisterUserUseCase } from '@/application/identity/RegisterUserUseCase';
import { ConflictError, ValidationError } from '@/domain/shared/DomainError';
import { InMemoryUserRepository } from '../_fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../_fakes/FakePasswordHasher';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';

describe('RegisterUserUseCase', () => {
  let repository: InMemoryUserRepository;
  let events: RecordingEventPublisher;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
    events = new RecordingEventPublisher();
    useCase = new RegisterUserUseCase(repository, new FakePasswordHasher(), events);
  });

  it('registers a new user and publishes a UserRegistered event', async () => {
    const dto = await useCase.execute({
      email: 'seller@example.com',
      password: 'password123',
      role: 'seller',
    });

    expect(dto.email).toBe('seller@example.com');
    expect(dto.role).toBe('seller');
    expect(events.published).toHaveLength(1);
    expect(events.published[0].name).toBe('user.registered');
  });

  it('never returns the password or password hash', async () => {
    const dto = await useCase.execute({
      email: 'a@example.com',
      password: 'password123',
      role: 'buyer',
    });
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with ConflictError', async () => {
    await useCase.execute({ email: 'dup@example.com', password: 'password123', role: 'buyer' });
    await expect(
      useCase.execute({ email: 'dup@example.com', password: 'password456', role: 'seller' }),
    ).rejects.toThrow(ConflictError);
  });

  it('treats email as case-insensitive when checking for duplicates', async () => {
    await useCase.execute({ email: 'Dup@Example.com', password: 'password123', role: 'buyer' });
    await expect(
      useCase.execute({ email: 'dup@example.com', password: 'password456', role: 'buyer' }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects an invalid email format', async () => {
    await expect(
      useCase.execute({ email: 'not-an-email', password: 'password123', role: 'buyer' }),
    ).rejects.toThrow(ValidationError);
  });
});
