import type { UserRole } from '../../domain/identity/User';

/** The authenticated caller of a use case, as resolved from the session — never trusted from a request body. */
export interface RequestingUser {
  id: string;
  role: UserRole;
}
