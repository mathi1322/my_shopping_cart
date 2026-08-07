import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../../domain/identity/PasswordHasher';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

/**
 * Node's built-in scrypt KDF — no extra dependency (bcrypt/argon2) needed
 * for a demo of this size. Hash format is `<saltHex>:<derivedKeyHex>`.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer;
    return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    const [saltHex, keyHex] = passwordHash.split(':');
    if (!saltHex || !keyHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const storedKey = Buffer.from(keyHex, 'hex');
    const derivedKey = (await scrypt(plainPassword, salt, storedKey.length)) as Buffer;

    return derivedKey.length === storedKey.length && timingSafeEqual(derivedKey, storedKey);
  }
}
