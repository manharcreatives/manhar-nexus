import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { RealtimeEvent, RealtimeTopic } from './realtime.types';

/**
 * Publishing seam. The in-process RealtimeBus implements it today; a multi
 * instance deployment swaps in one class (e.g. a Redis pub/sub adapter that
 * publishes to a channel and re-emits received messages locally) without
 * touching any producer.
 */
export interface RealtimePublisher {
  publish(event: RealtimeEvent): void;
}

/**
 * In-process bus: one RxJS Subject per business, created lazily and dropped
 * when its last subscriber leaves (no leak). SCALING: events only reach
 * subscribers connected to THIS process. With more than one API instance,
 * replace the implementation with a Redis (or Postgres LISTEN/NOTIFY) adapter.
 */
@Injectable()
export class RealtimeBus implements RealtimePublisher {
  private readonly logger = new Logger(RealtimeBus.name);
  private readonly subjects = new Map<string, Subject<RealtimeEvent>>();
  private subscribers = 0;

  /** Never throws, never blocks: safe to call from any request path. */
  publish(event: RealtimeEvent): void {
    try {
      this.subjects.get(event.businessId)?.next(event);
    } catch (err) {
      this.logger.warn(`realtime publish failed: ${(err as Error).message}`);
    }
  }

  /** Typed convenience for producers. */
  emit(businessId: string | null | undefined, topic: RealtimeTopic, locationId: string | null = null): void {
    if (!businessId) return;
    this.publish({ businessId, topic, locationId, at: new Date().toISOString() });
  }

  subscribe(businessId: string): Observable<RealtimeEvent> {
    return new Observable<RealtimeEvent>((observer) => {
      let subject = this.subjects.get(businessId);
      if (!subject) {
        subject = new Subject<RealtimeEvent>();
        this.subjects.set(businessId, subject);
      }
      const sub = subject.subscribe(observer);
      this.subscribers += 1;
      return () => {
        sub.unsubscribe();
        this.subscribers -= 1;
        const s = this.subjects.get(businessId);
        if (s && !s.observed) this.subjects.delete(businessId);
      };
    });
  }

  /** Live subscriber count (diagnostics / tests). */
  subscriberCount(): number {
    return this.subscribers;
  }
}
