import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleDomainEventPublisher } from '@/application/shared/DomainEventPublisher';
import { UserRegistered } from '@/domain/identity/UserEvents';
import { UserId } from '@/domain/identity/UserId';
import { Email } from '@/domain/identity/Email';

describe('ConsoleDomainEventPublisher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts personal data from the logged event', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const event = new UserRegistered(
      UserId.create(),
      Email.fromString('someone@example.com'),
      'buyer',
    );

    await new ConsoleDomainEventPublisher().publish([event]);

    const output = log.mock.calls[0].join(' ');
    expect(output).toContain('user.registered');
    expect(output).toContain('[redacted]');
    expect(output).not.toContain('someone@example.com');
  });
});
