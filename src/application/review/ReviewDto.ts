import type { Review } from '../../domain/review/Review';

export interface ReviewDto {
  id: string;
  productId: string;
  authorName: string;
  /** Written by a buyer who received the product (seeded demo reviews are not). */
  verifiedPurchase: boolean;
  rating: number;
  comment: string;
  createdAt: string;
}

export function toReviewDto(review: Review): ReviewDto {
  return {
    id: review.id,
    productId: review.productId,
    authorName: review.authorName,
    verifiedPurchase: review.authorId !== null,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}
