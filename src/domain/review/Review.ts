import { randomUUID } from 'node:crypto';
import { ValidationError } from '../shared/DomainError';

export interface Review {
  id: string;
  productId: string;
  /** The buyer who wrote it; null for seeded/demo reviews. */
  authorId: string | null;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export const MAX_REVIEW_COMMENT_LENGTH = 2000;

export interface WriteReviewInput {
  productId: string;
  authorId: string;
  authorName: string;
  rating: number;
  comment: string;
}

/** Validates and creates a new review; eligibility (a delivered purchase) is checked by the use case. */
export function writeReview(input: WriteReviewInput): Review {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ValidationError('Rating must be a whole number from 1 to 5');
  }
  const comment = input.comment.trim();
  if (comment.length > MAX_REVIEW_COMMENT_LENGTH) {
    throw new ValidationError(
      `Review comment cannot exceed ${MAX_REVIEW_COMMENT_LENGTH} characters`,
    );
  }
  return {
    id: randomUUID(),
    productId: input.productId,
    authorId: input.authorId,
    authorName: input.authorName,
    rating: input.rating,
    comment,
    createdAt: new Date(),
  };
}
