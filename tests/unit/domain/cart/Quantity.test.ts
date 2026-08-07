import { describe, expect, it } from 'vitest';
import { Quantity } from '@/domain/cart/Quantity';
import { ValidationError } from '@/domain/shared/DomainError';

describe('Quantity', () => {
  it('accepts a positive integer', () => {
    expect(Quantity.of(1).value).toBe(1);
    expect(Quantity.of(Quantity.MAX).value).toBe(Quantity.MAX);
  });

  it.each([0, -1, 1.5])('rejects a non-positive or fractional amount (%j)', (amount) => {
    expect(() => Quantity.of(amount)).toThrow(ValidationError);
  });

  it('rejects an amount above the maximum', () => {
    expect(() => Quantity.of(Quantity.MAX + 1)).toThrow(ValidationError);
  });

  it('adds two quantities together', () => {
    const result = Quantity.of(3).plus(Quantity.of(4));
    expect(result.value).toBe(7);
  });

  it('throws when the sum exceeds the maximum', () => {
    expect(() => Quantity.of(Quantity.MAX).plus(Quantity.of(1))).toThrow(ValidationError);
  });
});
