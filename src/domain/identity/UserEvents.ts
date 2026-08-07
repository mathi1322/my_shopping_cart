import type { DomainEvent } from '../shared/DomainEvent';
import type { Email } from './Email';
import type { UserId } from './UserId';
import type { UserRole } from './User';

export class UserRegistered implements DomainEvent {
  readonly name = 'user.registered';
  readonly occurredAt = new Date();

  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly role: UserRole,
  ) {}
}
