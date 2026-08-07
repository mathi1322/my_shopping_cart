import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleProductRepository } from '@/infrastructure/repositories/DrizzleProductRepository';
import { Product } from '@/domain/product/Product';
import { ProductId } from '@/domain/product/ProductId';
import { VendorId } from '@/domain/product/VendorId';
import { Money } from '@/domain/shared/Money';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';

const { db, client } = createTestDb();
const repository = new DrizzleProductRepository(db);
let vendorId: string;

function makeProduct(overrides: Partial<Parameters<typeof Product.create>[0]> = {}) {
  return Product.create({
    vendorId: VendorId.fromString(vendorId),
    name: 'Wireless Mouse',
    description: 'A reliable wireless mouse',
    price: Money.fromCents(1999),
    stockQuantity: 10,
    ...overrides,
  });
}

describe('DrizzleProductRepository', () => {
  beforeEach(async () => {
    await truncateAll(db);
    vendorId = (await seedTestUser(db, 'seller')).id;
  });

  afterAll(async () => {
    await client.end();
  });

  it('saves and retrieves a product by id', async () => {
    const product = makeProduct();
    await repository.save(product);

    const found = await repository.findById(product.id);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Wireless Mouse');
    expect(found?.price.cents).toBe(1999);
    expect(found?.vendorId.toString()).toBe(vendorId);
  });

  it('returns null for an unknown id', async () => {
    const found = await repository.findById(ProductId.create());
    expect(found).toBeNull();
  });

  it('updates an existing product on save (upsert)', async () => {
    const product = makeProduct();
    await repository.save(product);

    product.updateDetails({ stockQuantity: 3 });
    await repository.save(product);

    const found = await repository.findById(product.id);
    expect(found?.stockQuantity).toBe(3);
  });

  it('lists all products ordered by creation time', async () => {
    await repository.save(makeProduct({ name: 'A' }));
    await repository.save(makeProduct({ name: 'B' }));

    const all = await repository.findAll();
    expect(all).toHaveLength(2);
  });

  it('finds products by vendor id', async () => {
    const otherVendorId = (await seedTestUser(db, 'seller')).id;
    await repository.save(makeProduct({ name: 'Mine' }));
    await repository.save(
      makeProduct({ name: 'Theirs', vendorId: VendorId.fromString(otherVendorId) }),
    );

    const mine = await repository.findByVendorId(VendorId.fromString(vendorId));
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe('Mine');
  });

  it('deletes a product', async () => {
    const product = makeProduct();
    await repository.save(product);

    await repository.delete(product.id);

    expect(await repository.findById(product.id)).toBeNull();
  });
});
