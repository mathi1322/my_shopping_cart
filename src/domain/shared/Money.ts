import { ValidationError } from './DomainError';

/**
 * Money is stored as an integer number of cents to avoid floating-point
 * rounding errors in totals.
 */
export class Money {
  private constructor(
    private readonly amountInCents: number,
    private readonly currency: string,
  ) {}

  static fromCents(amountInCents: number, currency = 'USD'): Money {
    if (!Number.isInteger(amountInCents)) {
      throw new ValidationError('Money amount must be an integer number of cents');
    }
    if (amountInCents < 0) {
      throw new ValidationError('Money amount cannot be negative');
    }
    return new Money(amountInCents, currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  get cents(): number {
    return this.amountInCents;
  }

  get currencyCode(): string {
    return this.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountInCents + other.amountInCents, this.currency);
  }

  multiply(factor: number): Money {
    if (!Number.isInteger(factor) || factor < 0) {
      throw new ValidationError('Multiplication factor must be a non-negative integer');
    }
    return new Money(this.amountInCents * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountInCents === other.amountInCents && this.currency === other.currency;
  }

  toJSON(): { amountInCents: number; currency: string } {
    return { amountInCents: this.amountInCents, currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationError(
        `Cannot operate on different currencies: ${this.currency} vs ${other.currency}`,
      );
    }
  }
}
