import { randomUUID } from 'node:crypto';
import { ValidationError } from '../shared/DomainError';

export class OrderId {
  private constructor(private readonly value: string) {}

  static create(): OrderId {
    return new OrderId(randomUUID());
  }

  static fromString(value: string): OrderId {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('OrderId cannot be empty');
    }
    return new OrderId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
}
