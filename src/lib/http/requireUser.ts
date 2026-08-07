import { UnauthorizedError } from '../../domain/shared/DomainError';
import type { RequestingUser } from '../../application/shared/RequestingUser';
import type { UserDto } from '../../application/identity/UserDto';

/** Authentication check (are you logged in at all?) — role/ownership authorization stays in the use case. */
export function requireUser(user: UserDto | null): RequestingUser {
  if (!user) {
    throw new UnauthorizedError('You must be logged in to do this');
  }
  return { id: user.id, role: user.role };
}
