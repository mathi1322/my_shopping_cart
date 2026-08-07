import { randomUUID } from 'node:crypto';
import { ValidationError } from '../shared/DomainError';

export class ProductId {
  private constructor(private readonly value: string) {}

  static create(): ProductId {
    return new ProductId(randomUUID());
  }

  static fromString(value: string): ProductId {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('ProductId cannot be empty');
    }
    return new ProductId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ProductId): boolean {
    return this.value === other.value;
  }
}
