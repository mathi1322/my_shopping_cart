import { UserId } from '../../domain/identity/UserId';
import type { UserRepository } from '../../domain/identity/UserRepository';
import type { SessionStore } from './SessionStore';
import { toUserDto, type UserDto } from './UserDto';

export class ResolveSessionUseCase {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(sessionId: string): Promise<UserDto | null> {
    const session = await this.sessionStore.resolve(sessionId);
    if (!session) {
      return null;
    }

    const user = await this.userRepository.findById(UserId.fromString(session.userId));
    return user ? toUserDto(user) : null;
  }
}
