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

  describe('search', () => {
    it('filters in SQL and pages newest first', async () => {
      const otherVendorId = (await seedTestUser(db, 'seller')).id;
      const saved = [];
      for (const overrides of [
        {
          name: 'Pulse Oximeter',
          price: Money.fromCents(150_000),
          category: 'Diagnostic Devices' as const,
        },
        { name: 'N95 Masks', price: Money.fromCents(50_000), category: 'PPE & Masks' as const },
        { name: 'Empty shelf', stockQuantity: 0 },
        { name: 'Theirs', vendorId: VendorId.fromString(otherVendorId) },
      ]) {
        const product = makeProduct(overrides);
        await repository.save(product);
        saved.push(product);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      const names = async (criteria: Parameters<typeof repository.search>[0]) =>
        (await repository.search(criteria, { limit: 50, offset: 0 })).items.map((p) => p.name);

      expect(await names({})).toEqual(['Theirs', 'Empty shelf', 'N95 Masks', 'Pulse Oximeter']);
      expect(await names({ vendorId: VendorId.fromString(otherVendorId) })).toEqual(['Theirs']);
      expect(await names({ text: 'oXiMeTeR' })).toEqual(['Pulse Oximeter']);
      expect(await names({ categories: ['PPE & Masks'] })).toEqual(['N95 Masks']);
      expect(await names({ minPriceCents: 100_000 })).toEqual(['Pulse Oximeter']);
      expect(await names({ inStockOnly: true })).not.toContain('Empty shelf');

      const page = await repository.search({}, { limit: 2, offset: 2 });
      expect(page.total).toBe(4);
      expect(page.items.map((p) => p.name)).toEqual(['N95 Masks', 'Pulse Oximeter']);
    });

    it('treats LIKE wildcards in search text literally', async () => {
      await repository.save(makeProduct({ name: '100% cotton mask' }));
      await repository.save(makeProduct({ name: 'Plain mask' }));

      const matches = await repository.search({ text: '%' }, { limit: 10, offset: 0 });
      expect(matches.items.map((p) => p.name)).toEqual(['100% cotton mask']);
      expect((await repository.search({ text: '_' }, { limit: 10, offset: 0 })).total).toBe(0);
    });

    it('lists the categories in use', async () => {
      await repository.save(makeProduct({ category: 'PPE & Masks' }));
      await repository.save(makeProduct({ category: 'Diagnostic Devices' }));
      await repository.save(makeProduct({ category: 'PPE & Masks' }));
      expect(await repository.categoriesInUse()).toEqual(['Diagnostic Devices', 'PPE & Masks']);
    });
  });
});
