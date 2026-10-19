import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleReviewRepository } from '@/infrastructure/repositories/DrizzleReviewRepository';
import { DrizzleProductRepository } from '@/infrastructure/repositories/DrizzleProductRepository';
import { DrizzleVendorDirectory } from '@/infrastructure/repositories/DrizzleVendorDirectory';
import { DrizzleUserRepository } from '@/infrastructure/repositories/DrizzleUserRepository';
import { UpdateUserProfileUseCase } from '@/application/identity/UpdateUserProfileUseCase';
import { Product } from '@/domain/product/Product';
import { VendorId } from '@/domain/product/VendorId';
import { Money } from '@/domain/shared/Money';
import { writeReview } from '@/domain/review/Review';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';

const { db, client } = createTestDb();
const reviews = new DrizzleReviewRepository(db);
const products = new DrizzleProductRepository(db);
const noEvents = { publish: async () => {} };

afterAll(async () => {
  await client.end();
});

describe('DrizzleReviewRepository', () => {
  let product: Product;
  let buyerId: string;

  beforeEach(async () => {
    await truncateAll(db);
    const seller = await seedTestUser(db, 'seller');
    buyerId = (await seedTestUser(db, 'buyer')).id;
    product = Product.create({
      vendorId: VendorId.fromString(seller.id),
      name: 'Thermometer',
      description: '',
      price: Money.fromCents(49_900),
      stockQuantity: 5,
    });
    await products.save(product);
  });

  const review = (authorId: string, rating: number) =>
    writeReview({
      productId: product.id.toString(),
      authorId,
      authorName: 'Asha',
      rating,
      comment: 'ok',
    });

  it('stores one review per author, even when submitted concurrently', async () => {
    const results = await Promise.all(
      [review(buyerId, 5), review(buyerId, 1)].map((r) => reviews.create(r)),
    );
    expect(results.sort()).toEqual([false, true]);
    expect(await reviews.hasReviewed(product.id, buyerId)).toBe(true);
    expect((await reviews.summaryFor(product.id)).count).toBe(1);
  });

  it('summarises count and average rating', async () => {
    expect(await reviews.summaryFor(product.id)).toEqual({ count: 0, averageRating: null });
    const otherBuyer = (await seedTestUser(db, 'buyer')).id;
    await reviews.create(review(buyerId, 5));
    await reviews.create(review(otherBuyer, 2));
    expect(await reviews.summaryFor(product.id)).toEqual({ count: 2, averageRating: 3.5 });
    expect(await reviews.findByProductId(product.id, 1)).toHaveLength(1);
  });
});

describe('DrizzleVendorDirectory', () => {
  it('prefers company name, then name, and skips unknown ids', async () => {
    await truncateAll(db);
    const users = new DrizzleUserRepository(db);
    const updateProfile = new UpdateUserProfileUseCase(users, noEvents);
    const company = await seedTestUser(db, 'seller');
    const person = await seedTestUser(db, 'seller');
    const blank = await seedTestUser(db, 'seller');
    await updateProfile.execute(company.id, { name: 'Ravi', companyName: 'CareWell Medical' });
    await updateProfile.execute(person.id, { name: 'Meera Shah' });

    const names = await new DrizzleVendorDirectory(db).displayNames([
      company.id,
      person.id,
      blank.id,
      'no-such-user',
    ]);
    expect(names.get(company.id)).toBe('CareWell Medical');
    expect(names.get(person.id)).toBe('Meera Shah');
    expect(names.get(blank.id)).toBe('MediKart seller');
    expect(names.has('no-such-user')).toBe(false);
  });
});
