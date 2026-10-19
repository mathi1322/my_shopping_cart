import type { ProductId } from '../product/ProductId';
import type { Review } from './Review';

export interface ReviewSummary {
  count: number;
  /** Null when there are no reviews. */
  averageRating: number | null;
}

export interface ReviewRepository {
  /** Newest first, at most `limit`. */
  findByProductId(productId: ProductId, limit: number): Promise<Review[]>;
  summaryFor(productId: ProductId): Promise<ReviewSummary>;
  hasReviewed(productId: ProductId, authorId: string): Promise<boolean>;
  /** Stores the review; returns false (storing nothing) if this author already reviewed the product. */
  create(review: Review): Promise<boolean>;
}
