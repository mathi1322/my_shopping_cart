import type { DomainEvent } from '@/domain/shared/DomainEvent';
import type { DomainEventPublisher } from '@/application/shared/DomainEventPublisher';

export class RecordingEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
}
