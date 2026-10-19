import { and, avg, count, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { reviews } from '../db/schema';
import type { ProductId } from '../../domain/product/ProductId';
import type { Review } from '../../domain/review/Review';
import type { ReviewRepository, ReviewSummary } from '../../domain/review/ReviewRepository';

type ReviewRow = typeof reviews.$inferSelect;

function toDomain(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.productId,
    authorId: row.authorId,
    authorName: row.authorName,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

export class DrizzleReviewRepository implements ReviewRepository {
  constructor(private readonly db: Database) {}

  async findByProductId(productId: ProductId, limit: number): Promise<Review[]> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.productId, productId.toString()))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(limit);
    return rows.map(toDomain);
  }

  async summaryFor(productId: ProductId): Promise<ReviewSummary> {
    const [row] = await this.db
      .select({ count: count(), average: avg(reviews.rating) })
      .from(reviews)
      .where(eq(reviews.productId, productId.toString()));
    return {
      count: row.count,
      averageRating: row.average === null ? null : Number(row.average),
    };
  }

  async hasReviewed(productId: ProductId, authorId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.productId, productId.toString()), eq(reviews.authorId, authorId)))
      .limit(1);
    return rows.length > 0;
  }

  async create(review: Review): Promise<boolean> {
    // The (product_id, author_id) unique index makes this race-safe: a concurrent
    // duplicate submission inserts nothing instead of a second review.
    const inserted = await this.db
      .insert(reviews)
      .values({
        id: review.id,
        productId: review.productId,
        authorId: review.authorId,
        authorName: review.authorName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      })
      .onConflictDoNothing({ target: [reviews.productId, reviews.authorId] })
      .returning({ id: reviews.id });
    return inserted.length > 0;
  }
}
