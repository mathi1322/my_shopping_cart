import { randomBytes } from 'node:crypto';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Database } from '../db/client';
import { sessions } from '../db/schema';
import type { SessionStore } from '../../application/identity/SessionStore';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class DrizzleSessionStore implements SessionStore {
  constructor(private readonly db: Database) {}

  async create(userId: string): Promise<string> {
    // Housekeeping piggybacks on login/register, so expired rows never pile up
    // (indexed on expires_at, so this stays cheap).
    await this.db.delete(sessions).where(lte(sessions.expiresAt, new Date()));

    const id = randomBytes(32).toString('hex');
    await this.db.insert(sessions).values({
      id,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return id;
  }

  async resolve(sessionId: string): Promise<{ userId: string } | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);

    return row ? { userId: row.userId } : null;
  }

  async destroy(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }
}
