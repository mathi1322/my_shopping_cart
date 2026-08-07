import { randomUUID } from 'node:crypto';
import { ValidationError } from '../shared/DomainError';

export class CartId {
  private constructor(private readonly value: string) {}

  static create(): CartId {
    return new CartId(randomUUID());
  }

  static fromString(value: string): CartId {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('CartId cannot be empty');
    }
    return new CartId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CartId): boolean {
    return this.value === other.value;
  }
}
