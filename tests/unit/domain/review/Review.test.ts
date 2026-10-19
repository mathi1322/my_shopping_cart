import { describe, expect, it } from 'vitest';
import { writeReview } from '@/domain/review/Review';
import { ValidationError } from '@/domain/shared/DomainError';

const base = { productId: 'p-1', authorId: 'u-1', authorName: 'Asha', rating: 4, comment: '' };

describe('writeReview', () => {
  it('accepts whole-number ratings from 1 to 5 and trims the comment', () => {
    const review = writeReview({ ...base, rating: 5, comment: '  Works well  ' });
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Works well');
    expect(review.authorId).toBe('u-1');
  });

  it.each([0, 6, 3.5, Number.NaN])('rejects a rating of %s', (rating) => {
    expect(() => writeReview({ ...base, rating })).toThrow(ValidationError);
  });

  it('rejects comments over 2000 characters', () => {
    expect(() => writeReview({ ...base, comment: 'x'.repeat(2001) })).toThrow(ValidationError);
  });
});
