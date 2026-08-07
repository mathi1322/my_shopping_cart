import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users } from '../db/schema';
import { User } from '../../domain/identity/User';
import { UserId } from '../../domain/identity/UserId';
import { Email } from '../../domain/identity/Email';
import type { UserRepository } from '../../domain/identity/UserRepository';

type UserRow = typeof users.$inferSelect;

function toDomain(row: UserRow): User {
  return User.reconstitute({
    id: UserId.fromString(row.id),
    email: Email.fromString(row.email),
    passwordHash: row.passwordHash,
    role: row.role,
    name: row.name,
    phone: row.phone,
    address: row.address,
    companyName: row.companyName,
    companyAddress: row.companyAddress,
    gstNumber: row.gstNumber,
    createdAt: row.createdAt,
  });
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async save(user: User): Promise<void> {
    const row = {
      id: user.id.toString(),
      email: user.email.toString(),
      passwordHash: user.passwordHash,
      role: user.role,
      name: user.name,
      phone: user.phone,
      address: user.address,
      companyName: user.companyName,
      companyAddress: user.companyAddress,
      gstNumber: user.gstNumber,
      createdAt: user.createdAt,
    };

    await this.db
      .insert(users)
      .values(row)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: row.name,
          phone: row.phone,
          address: row.address,
          companyName: row.companyName,
          companyAddress: row.companyAddress,
          gstNumber: row.gstNumber,
        },
      });
  }

  async findById(id: UserId): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id.toString())).limit(1);
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toString()))
      .limit(1);
    return row ? toDomain(row) : null;
  }
}
