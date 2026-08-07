import { describe, expect, it } from 'vitest';
import { Email } from '@/domain/identity/Email';
import { ValidationError } from '@/domain/shared/DomainError';

describe('Email', () => {
  it('normalizes to lowercase and trims whitespace', () => {
    const email = Email.fromString('  Jane.Doe@Example.com  ');
    expect(email.toString()).toBe('jane.doe@example.com');
  });

  it.each(['not-an-email', 'missing@domain', '@missing-local.com', ''])(
    'rejects an invalid email (%j)',
    (value) => {
      expect(() => Email.fromString(value)).toThrow(ValidationError);
    },
  );

  it('compares equality case-insensitively via normalization', () => {
    const a = Email.fromString('User@Example.com');
    const b = Email.fromString('user@example.com');
    expect(a.equals(b)).toBe(true);
  });
});
