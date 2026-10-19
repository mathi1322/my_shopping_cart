import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '@/lib/http/rateLimit';
import { TooManyRequestsError } from '@/domain/shared/DomainError';

describe('FixedWindowRateLimiter', () => {
  it('allows up to the limit, then throws with the seconds left in the window', () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);
    limiter.hit('k', 0);
    limiter.hit('k', 1_000);

    expect(() => limiter.hit('k', 15_000)).toThrow(TooManyRequestsError);
    try {
      limiter.hit('k', 15_000);
    } catch (error) {
      expect((error as TooManyRequestsError).retryAfterSeconds).toBe(45);
    }
  });

  it('starts a fresh window once the old one expires', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    limiter.hit('k', 0);
    expect(() => limiter.hit('k', 59_999)).toThrow(TooManyRequestsError);
    expect(() => limiter.hit('k', 60_000)).not.toThrow();
  });

  it('tracks keys independently', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    limiter.hit('a', 0);
    expect(() => limiter.hit('b', 0)).not.toThrow();
  });
});
