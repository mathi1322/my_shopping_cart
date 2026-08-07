import type { PasswordHasher } from '@/domain/identity/PasswordHasher';

/** Deterministic, non-cryptographic stand-in for unit tests — real hashing is exercised via ScryptPasswordHasher's own tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return `fake-hash:${plainPassword}`;
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `fake-hash:${plainPassword}`;
  }
}
