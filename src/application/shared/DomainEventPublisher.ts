import type { DomainEvent } from '../../domain/shared/DomainEvent';

export interface DomainEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

/**
 * Logs events for visibility today. This is the seam a future subscriber —
 * e.g. "email the vendor when their product is added to a cart" — would
 * plug into, without changing any use case. See ARCHITECTURE.md.
 */
export class ConsoleDomainEventPublisher implements DomainEventPublisher {
  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      console.log(`[domain-event] ${event.name}`, JSON.stringify(event));
    }
  }
}
