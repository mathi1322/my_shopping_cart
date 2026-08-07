/**
 * Sessions are opaque server-side tokens, not domain objects with business
 * invariants, so this port lives in the application layer rather than
 * alongside User in the domain.
 */
export interface SessionStore {
  create(userId: string): Promise<string>;
  resolve(sessionId: string): Promise<{ userId: string } | null>;
  destroy(sessionId: string): Promise<void>;
}
