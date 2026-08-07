import type { User } from '../../domain/identity/User';
import type { UserRole } from '../../domain/identity/User';

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  companyAddress: string | null;
  gstNumber: string | null;
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id.toString(),
    email: user.email.toString(),
    role: user.role,
    name: user.name,
    phone: user.phone,
    address: user.address,
    companyName: user.companyName,
    companyAddress: user.companyAddress,
    gstNumber: user.gstNumber,
    createdAt: user.createdAt.toISOString(),
  };
}
