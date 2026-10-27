import { Injectable } from '@nestjs/common';
import { MAX_STREAMS_PER_USER } from './realtime.types';

export interface OpenStream {
  /** Send a final event with this name and end the response. */
  close(reason: 'replaced'): void;
}

/** Tracks open streams per user so the cap can evict the oldest. */
@Injectable()
export class RealtimeStreams {
  private readonly byUser = new Map<string, Set<OpenStream>>();

  /** Register a stream; evicts the oldest ones beyond the cap. Returns unregister fn. */
  register(userId: string, stream: OpenStream): () => void {
    let set = this.byUser.get(userId);
    if (!set) {
      set = new Set();
      this.byUser.set(userId, set);
    }
    set.add(stream);
    // Sets iterate in insertion order -> first = oldest.
    while (set.size > MAX_STREAMS_PER_USER) {
      const oldest = set.values().next().value as OpenStream;
      set.delete(oldest);
      oldest.close('replaced');
    }
    return () => {
      const s = this.byUser.get(userId);
      if (!s) return;
      s.delete(stream);
      if (s.size === 0) this.byUser.delete(userId);
    };
  }

  count(): number {
    let n = 0;
    for (const s of this.byUser.values()) n += s.size;
    return n;
  }
}
