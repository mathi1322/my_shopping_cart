import { UserId } from '../../domain/identity/UserId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { UserRepository } from '../../domain/identity/UserRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import { toUserDto, type UserDto } from './UserDto';

export interface UpdateUserProfileInput {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  gstNumber?: string | null;
}

export class UpdateUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(userId: string, input: UpdateUserProfileInput): Promise<UserDto> {
    const user = await this.userRepository.findById(UserId.fromString(userId));
    if (!user) {
      throw new NotFoundError(`User ${userId} not found`);
    }

    user.updateProfile(input);

    await this.userRepository.save(user);
    await this.eventPublisher.publish(user.pullDomainEvents());

    return toUserDto(user);
  }
}
