import { ValidationError } from '../shared/DomainError';

/**
 * Identifies the vendor that owns a product listing. There is no vendor
 * account system yet (see ARCHITECTURE.md — "Extension points"), but every
 * product is attributed to a vendor from day one so that ownership, seller
 * dashboards, and order notifications can be layered on later without a
 * schema migration on the product table.
 */
export class VendorId {
  static readonly UNASSIGNED = new VendorId('unassigned');

  private constructor(private readonly value: string) {}

  static fromString(value: string): VendorId {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('VendorId cannot be empty');
    }
    return new VendorId(value.trim());
  }

  toString(): string {
    return this.value;
  }

  equals(other: VendorId): boolean {
    return this.value === other.value;
  }
}
