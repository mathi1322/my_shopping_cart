import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { reviews } from '../db/schema';
import type { ProductId } from '../../domain/product/ProductId';
import type { Review } from '../../domain/review/Review';
import type { ReviewRepository } from '../../domain/review/ReviewRepository';

type ReviewRow = typeof reviews.$inferSelect;

function toDomain(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.productId,
    authorName: row.authorName,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

export class DrizzleReviewRepository implements ReviewRepository {
  constructor(private readonly db: Database) {}

  async findByProductId(productId: ProductId): Promise<Review[]> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.productId, productId.toString()))
      .orderBy(desc(reviews.createdAt));
    return rows.map(toDomain);
  }
}
