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
    createdAt: row.createdAt,
  });
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async save(user: User): Promise<void> {
    await this.db
      .insert(users)
      .values({
        id: user.id.toString(),
        email: user.email.toString(),
        passwordHash: user.passwordHash,
        role: user.role,
        createdAt: user.createdAt,
      })
      .onConflictDoNothing({ target: users.id });
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
