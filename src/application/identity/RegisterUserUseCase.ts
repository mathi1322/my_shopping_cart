import { User } from '../../domain/identity/User';
import type { UserRole } from '../../domain/identity/User';
import { Email } from '../../domain/identity/Email';
import { ConflictError } from '../../domain/shared/DomainError';
import type { UserRepository } from '../../domain/identity/UserRepository';
import type { PasswordHasher } from '../../domain/identity/PasswordHasher';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import { toUserDto, type UserDto } from './UserDto';

export interface RegisterUserInput {
  email: string;
  password: string;
  role: UserRole;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: RegisterUserInput): Promise<UserDto> {
    const email = Email.fromString(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.register({ email, passwordHash, role: input.role });

    await this.userRepository.save(user);
    await this.eventPublisher.publish(user.pullDomainEvents());

    return toUserDto(user);
  }
}
