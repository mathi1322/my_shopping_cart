import { ValidationError } from '../shared/DomainError';

export class Quantity {
  static readonly MAX = 100;

  private constructor(private readonly amount: number) {}

  static of(amount: number): Quantity {
    if (!Number.isInteger(amount)) {
      throw new ValidationError('Quantity must be an integer');
    }
    if (amount < 1) {
      throw new ValidationError('Quantity must be at least 1');
    }
    if (amount > Quantity.MAX) {
      throw new ValidationError(`Quantity cannot exceed ${Quantity.MAX}`);
    }
    return new Quantity(amount);
  }

  get value(): number {
    return this.amount;
  }

  plus(other: Quantity): Quantity {
    return Quantity.of(this.amount + other.amount);
  }
}
