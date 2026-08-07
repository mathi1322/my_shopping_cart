import type { User } from '../../domain/identity/User';
import type { UserRole } from '../../domain/identity/User';

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id.toString(),
    email: user.email.toString(),
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
