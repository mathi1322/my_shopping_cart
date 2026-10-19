import { TooManyRequestsError } from '../../domain/shared/DomainError';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window counter held in process memory. Good enough for the single
 * Node process this app runs as; with several instances behind a load
 * balancer, swap it for a shared store (e.g. Redis or a Postgres table).
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Counts one attempt for `key`, throwing TooManyRequestsError once the limit is exceeded. */
  hit(key: string, now = Date.now()): void {
    this.pruneExpired(now);

    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    window.count += 1;
    if (window.count > this.limit) {
      const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
      throw new TooManyRequestsError(
        'Too many attempts — please wait a few minutes and try again',
        retryAfterSeconds,
      );
    }
  }

  reset(): void {
    this.windows.clear();
  }

  private pruneExpired(now: number): void {
    // Bounded cleanup so memory can't grow without limit from many distinct keys.
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Per client + email: stops password guessing against one account. */
export const loginPerAccountLimiter = new FixedWindowRateLimiter(10, FIFTEEN_MINUTES);
/** Per client: stops one client spraying many accounts. */
export const loginPerClientLimiter = new FixedWindowRateLimiter(50, FIFTEEN_MINUTES);
export const registerPerClientLimiter = new FixedWindowRateLimiter(10, ONE_HOUR);

export function resetRateLimits(): void {
  loginPerAccountLimiter.reset();
  loginPerClientLimiter.reset();
  registerPerClientLimiter.reset();
}
