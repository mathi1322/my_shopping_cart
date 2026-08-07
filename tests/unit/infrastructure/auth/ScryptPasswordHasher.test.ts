import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from '@/infrastructure/auth/ScryptPasswordHasher';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('verifies a password against its own hash', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');
    expect(await hasher.verify('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');
    expect(await hasher.verify('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hasher.hash('same-password');
    const b = await hasher.hash('same-password');
    expect(a).not.toBe(b);
  });

  it('rejects a malformed hash instead of throwing', async () => {
    expect(await hasher.verify('anything', 'not-a-valid-hash')).toBe(false);
  });
});
