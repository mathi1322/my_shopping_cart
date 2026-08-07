import type { User } from '@/domain/identity/User';
import type { UserId } from '@/domain/identity/UserId';
import type { Email } from '@/domain/identity/Email';
import type { UserRepository } from '@/domain/identity/UserRepository';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.id.toString(), user);
  }

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id.toString()) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email.equals(email)) ?? null;
  }
}
