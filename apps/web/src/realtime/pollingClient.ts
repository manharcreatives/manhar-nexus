import type { RealtimeSignal, RealtimeStatus, RealtimeTransport } from './client';

/**
 * Serverless fallback: no long-lived connection is possible across independent
 * function instances, so pages rely on useLiveRefresh instead. The status is
 * explicit so the badge can say the view is polling rather than "offline".
 */
export class PollingClient implements RealtimeTransport {
  private status: RealtimeStatus = 'offline';
  private readonly statusListeners = new Set<(s: RealtimeStatus) => void>();

  getStatus(): RealtimeStatus {
    return this.status;
  }

  subscribe(_fn: (s: RealtimeSignal) => void): () => void {
    return () => undefined;
  }

  onStatus(fn: (s: RealtimeStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  start(_locationId: string | null): void {
    this.setStatus('polling');
  }

  stop(): void {
    this.setStatus('offline');
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const fn of [...this.statusListeners]) fn(status);
  }
}
