import type { User } from './User';
import type { UserId } from './UserId';
import type { Email } from './Email';

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
}
