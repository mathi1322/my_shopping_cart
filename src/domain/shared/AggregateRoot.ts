import type { DomainEvent } from './DomainEvent';

/**
 * Base for aggregate roots. Domain events are recorded here during a mutation
 * and drained by the application layer after the repository persists the
 * aggregate — this is the seam a future notification/read-model subscriber
 * would hook into without touching this class.
 */
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }
}
