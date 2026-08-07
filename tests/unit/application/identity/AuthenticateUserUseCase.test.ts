import { beforeEach, describe, expect, it } from 'vitest';
import { RegisterUserUseCase } from '@/application/identity/RegisterUserUseCase';
import { AuthenticateUserUseCase } from '@/application/identity/AuthenticateUserUseCase';
import { UnauthorizedError } from '@/domain/shared/DomainError';
import { InMemoryUserRepository } from '../_fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../_fakes/FakePasswordHasher';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';

describe('AuthenticateUserUseCase', () => {
  let repository: InMemoryUserRepository;
  let useCase: AuthenticateUserUseCase;

  beforeEach(async () => {
    repository = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    useCase = new AuthenticateUserUseCase(repository, hasher);

    await new RegisterUserUseCase(repository, hasher, new RecordingEventPublisher()).execute({
      email: 'buyer@example.com',
      password: 'correct-horse',
      role: 'buyer',
    });
  });

  it('authenticates with correct credentials', async () => {
    const dto = await useCase.execute({ email: 'buyer@example.com', password: 'correct-horse' });
    expect(dto.email).toBe('buyer@example.com');
  });

  it('authenticates case-insensitively on email', async () => {
    const dto = await useCase.execute({ email: 'Buyer@Example.com', password: 'correct-horse' });
    expect(dto.email).toBe('buyer@example.com');
  });

  it('throws UnauthorizedError for an unknown email', async () => {
    await expect(
      useCase.execute({ email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for a wrong password', async () => {
    await expect(
      useCase.execute({ email: 'buyer@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
