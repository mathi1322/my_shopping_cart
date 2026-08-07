import { AggregateRoot } from '../shared/AggregateRoot';
import { Email } from './Email';
import { UserId } from './UserId';
import { UserRegistered } from './UserEvents';
import type { PasswordHasher } from './PasswordHasher';

export type UserRole = 'buyer' | 'seller';

export interface UserProps {
  id: UserId;
  email: Email;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export interface RegisterUserInput {
  email: Email;
  passwordHash: string;
  role: UserRole;
}

export class User extends AggregateRoot {
  private constructor(private readonly props: UserProps) {
    super();
  }

  static register(input: RegisterUserInput): User {
    const user = new User({
      id: UserId.create(),
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: new Date(),
    });
    user.addDomainEvent(new UserRegistered(user.id, user.email, user.role));
    return user;
  }

  /** Rebuilds a User from persisted state — bypasses registration events. */
  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  async verifyPassword(plainPassword: string, hasher: PasswordHasher): Promise<boolean> {
    return hasher.verify(plainPassword, this.props.passwordHash);
  }

  get id(): UserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get role(): UserRole {
    return this.props.role;
  }

  /** Exposed only for persistence (see DrizzleUserRepository) — never put this in a DTO. */
  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isSeller(): boolean {
    return this.props.role === 'seller';
  }
}
