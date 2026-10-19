import { Email } from '../../domain/identity/Email';
import { UnauthorizedError } from '../../domain/shared/DomainError';
import type { UserRepository } from '../../domain/identity/UserRepository';
import type { PasswordHasher } from '../../domain/identity/PasswordHasher';
import { toUserDto, type UserDto } from './UserDto';

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<UserDto> {
    const email = Email.fromString(input.email);
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Spend the same KDF time as a real check, so response timing doesn't reveal which emails exist.
      await this.passwordHasher.hash(input.password);
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await user.verifyPassword(input.password, this.passwordHasher);
    if (!passwordMatches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    return toUserDto(user);
  }
}
