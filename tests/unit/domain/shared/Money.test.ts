import { describe, expect, it } from 'vitest';
import { Money } from '@/domain/shared/Money';
import { ValidationError } from '@/domain/shared/DomainError';

describe('Money', () => {
  it('creates money from a non-negative integer number of cents', () => {
    const money = Money.fromCents(1999);
    expect(money.cents).toBe(1999);
    expect(money.currencyCode).toBe('INR');
  });

  it('rejects negative amounts', () => {
    expect(() => Money.fromCents(-1)).toThrow(ValidationError);
  });

  it('rejects non-integer amounts', () => {
    expect(() => Money.fromCents(19.99)).toThrow(ValidationError);
  });

  it('adds two amounts of the same currency', () => {
    const total = Money.fromCents(500).add(Money.fromCents(250));
    expect(total.cents).toBe(750);
  });

  it('refuses to add different currencies', () => {
    const usd = Money.fromCents(500, 'USD');
    const eur = Money.fromCents(500, 'EUR');
    expect(() => usd.add(eur)).toThrow(ValidationError);
  });

  it('multiplies by a non-negative integer factor', () => {
    const line = Money.fromCents(300).multiply(3);
    expect(line.cents).toBe(900);
  });

  it('rejects a negative multiplication factor', () => {
    expect(() => Money.fromCents(300).multiply(-1)).toThrow(ValidationError);
  });

  it('compares equality by amount and currency', () => {
    expect(Money.fromCents(100).equals(Money.fromCents(100))).toBe(true);
    expect(Money.fromCents(100).equals(Money.fromCents(200))).toBe(false);
    expect(Money.fromCents(100, 'USD').equals(Money.fromCents(100, 'EUR'))).toBe(false);
  });

  it('zero() returns a zero amount in the given currency', () => {
    expect(Money.zero().cents).toBe(0);
    expect(Money.zero('EUR').currencyCode).toBe('EUR');
  });
});
