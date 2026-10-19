import { describe, expect, it } from 'vitest';
import { Product } from '@/domain/product/Product';
import { VendorId } from '@/domain/product/VendorId';
import { ProductId } from '@/domain/product/ProductId';
import { Money } from '@/domain/shared/Money';
import { ValidationError } from '@/domain/shared/DomainError';
import { ProductCreated, ProductUpdated } from '@/domain/product/ProductEvents';

function validInput(overrides: Partial<Parameters<typeof Product.create>[0]> = {}) {
  return {
    vendorId: VendorId.fromString('vendor-1'),
    name: 'Wireless Mouse',
    description: 'A reliable wireless mouse',
    price: Money.fromCents(1999),
    stockQuantity: 10,
    ...overrides,
  };
}

describe('Product', () => {
  it('creates a product and records a ProductCreated event', () => {
    const product = Product.create(validInput());

    expect(product.name).toBe('Wireless Mouse');
    expect(product.stockQuantity).toBe(10);
    expect(product.price.cents).toBe(1999);

    const events = product.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProductCreated);
  });

  it('draining domain events empties the queue', () => {
    const product = Product.create(validInput());
    product.pullDomainEvents();
    expect(product.pullDomainEvents()).toHaveLength(0);
  });

  it('trims the name and description', () => {
    const product = Product.create(validInput({ name: '  Mouse  ', description: '  desc  ' }));
    expect(product.name).toBe('Mouse');
    expect(product.description).toBe('desc');
  });

  it.each(['', '   '])('rejects a blank name (%j)', (name) => {
    expect(() => Product.create(validInput({ name }))).toThrow(ValidationError);
  });

  it('rejects a name over 200 characters', () => {
    expect(() => Product.create(validInput({ name: 'a'.repeat(201) }))).toThrow(ValidationError);
  });

  it('rejects a description over 2000 characters', () => {
    expect(() => Product.create(validInput({ description: 'a'.repeat(2001) }))).toThrow(
      ValidationError,
    );
  });

  it.each([-1, 1.5])('rejects an invalid stock quantity (%j)', (stockQuantity) => {
    expect(() => Product.create(validInput({ stockQuantity }))).toThrow(ValidationError);
  });

  it('allows a stock quantity of zero (out of stock, still listable)', () => {
    const product = Product.create(validInput({ stockQuantity: 0 }));
    expect(product.stockQuantity).toBe(0);
  });

  it('updates only the provided fields and records a ProductUpdated event', () => {
    const product = Product.create(validInput());
    product.pullDomainEvents();

    product.updateDetails({ stockQuantity: 5 });

    expect(product.stockQuantity).toBe(5);
    expect(product.name).toBe('Wireless Mouse');
    const events = product.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(ProductUpdated);
  });

  it('rejects invalid values passed to updateDetails', () => {
    const product = Product.create(validInput());
    expect(() => product.updateDetails({ name: '' })).toThrow(ValidationError);
    expect(() => product.updateDetails({ stockQuantity: -5 })).toThrow(ValidationError);
  });

  it('requires https for images on a new product', () => {
    expect(() => Product.create(validInput({ images: ['http://cdn.example/a.jpg'] }))).toThrow(
      ValidationError,
    );
    expect(() =>
      Product.create(validInput({ images: ['https://cdn.example/a.jpg'] })),
    ).not.toThrow();
  });

  it('keeps an existing http image editable but rejects newly added http images', () => {
    const legacy = Product.reconstitute({
      id: ProductId.create(),
      vendorId: VendorId.fromString('vendor-1'),
      name: 'Legacy listing',
      description: '',
      price: Money.fromCents(1999),
      stockQuantity: 10,
      category: 'Other',
      features: [],
      images: ['http://legacy.example/a.jpg'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Re-saving the existing image list (as the edit form does) is fine.
    expect(() =>
      legacy.updateDetails({ stockQuantity: 3, images: ['http://legacy.example/a.jpg'] }),
    ).not.toThrow();
    expect(legacy.stockQuantity).toBe(3);

    expect(() =>
      legacy.updateDetails({
        images: ['http://legacy.example/a.jpg', 'http://new.example/b.jpg'],
      }),
    ).toThrow(ValidationError);
  });

  it('reports whether it has enough stock for a requested quantity', () => {
    const product = Product.create(validInput({ stockQuantity: 3 }));
    expect(product.hasStockFor(3)).toBe(true);
    expect(product.hasStockFor(4)).toBe(false);
  });
});
