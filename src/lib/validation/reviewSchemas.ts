import { z } from 'zod';
import { MAX_REVIEW_COMMENT_LENGTH } from '../../domain/review/Review';

export const writeReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(MAX_REVIEW_COMMENT_LENGTH).default(''),
});
