import { AggregateRoot } from '../shared/AggregateRoot';
import { Email } from './Email';
import { UserId } from './UserId';
import { UserRegistered, UserProfileUpdated } from './UserEvents';
import type { PasswordHasher } from './PasswordHasher';

export type UserRole = 'buyer' | 'seller';

export interface UserProps {
  id: UserId;
  email: Email;
  passwordHash: string;
  role: UserRole;
  name: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  companyAddress: string | null;
  gstNumber: string | null;
  createdAt: Date;
}

export interface RegisterUserInput {
  email: Email;
  passwordHash: string;
  role: UserRole;
}

export interface UpdateProfileInput {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  gstNumber?: string | null;
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
      name: null,
      phone: null,
      address: null,
      companyName: null,
      companyAddress: null,
      gstNumber: null,
      createdAt: new Date(),
    });
    user.addDomainEvent(new UserRegistered(user.id, user.email, user.role));
    return user;
  }

  updateProfile(input: UpdateProfileInput): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.phone !== undefined) this.props.phone = input.phone;
    if (input.address !== undefined) this.props.address = input.address;
    if (input.companyName !== undefined) this.props.companyName = input.companyName;
    if (input.companyAddress !== undefined) this.props.companyAddress = input.companyAddress;
    if (input.gstNumber !== undefined) this.props.gstNumber = input.gstNumber;
    this.addDomainEvent(new UserProfileUpdated(this.id));
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

  get name(): string | null {
    return this.props.name;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get address(): string | null {
    return this.props.address;
  }

  get companyName(): string | null {
    return this.props.companyName;
  }

  get companyAddress(): string | null {
    return this.props.companyAddress;
  }

  get gstNumber(): string | null {
    return this.props.gstNumber;
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
