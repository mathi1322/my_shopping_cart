/**
 * Domain-owned port for password hashing — same pattern as a repository
 * interface: the domain defines the contract, infrastructure implements it
 * (see infrastructure/auth/ScryptPasswordHasher.ts), so the hashing
 * algorithm can change without touching User.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}
