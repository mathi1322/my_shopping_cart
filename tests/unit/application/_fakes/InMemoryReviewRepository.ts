import type { ProductId } from '@/domain/product/ProductId';
import type { Review } from '@/domain/review/Review';
import type { ReviewRepository, ReviewSummary } from '@/domain/review/ReviewRepository';

export class InMemoryReviewRepository implements ReviewRepository {
  readonly reviews: Review[] = [];

  async findByProductId(productId: ProductId, limit: number): Promise<Review[]> {
    return this.reviews
      .filter((r) => r.productId === productId.toString())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async summaryFor(productId: ProductId): Promise<ReviewSummary> {
    const matching = this.reviews.filter((r) => r.productId === productId.toString());
    return {
      count: matching.length,
      averageRating: matching.length
        ? matching.reduce((sum, r) => sum + r.rating, 0) / matching.length
        : null,
    };
  }

  async hasReviewed(productId: ProductId, authorId: string): Promise<boolean> {
    return this.reviews.some(
      (r) => r.productId === productId.toString() && r.authorId === authorId,
    );
  }

  async create(review: Review): Promise<boolean> {
    if (
      review.authorId &&
      (await this.hasReviewed({ toString: () => review.productId } as ProductId, review.authorId))
    ) {
      return false;
    }
    this.reviews.push(review);
    return true;
  }
}
