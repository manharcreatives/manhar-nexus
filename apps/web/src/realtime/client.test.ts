import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient, type RealtimeClientOptions, type RealtimeSignal } from './client';
import { change, failure, flush, frame, hello, mockStream } from './testStream';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(streams: { response: Response }[], extra: Partial<RealtimeClientOptions> = {}) {
  let i = 0;
  const fetchImpl = vi.fn((..._args: unknown[]) => Promise.resolve(streams[Math.min(i++, streams.length - 1)].response));
  const refresh = vi.fn(() => Promise.resolve(true));
  const client = new RealtimeClient({
    baseUrl: 'http://api',
    getToken: () => 'tok',
    refresh,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    random: () => 1,
    ...extra,
  });
  const signals: RealtimeSignal[] = [];
  client.subscribe((s) => signals.push(s));
  return { client, fetchImpl, refresh, signals };
}

describe('RealtimeClient', () => {
  it('sends the bearer token and location, goes live on hello with a resync, then emits change events', async () => {
    const s = mockStream();
    const { client, fetchImpl, signals } = setup([s]);
    client.start('loc-1');
    await flush();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api/admin/realtime/stream?locationId=loc-1');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(client.getStatus()).toBe('connecting');

    s.send(hello());
    await flush();
    expect(client.getStatus()).toBe('live');
    expect(signals).toEqual([{ kind: 'resync' }]);

    s.send(change('orders', 'loc-1') + ': ping\n\n' + change('bogus'));
    await flush();
    expect(signals).toEqual([{ kind: 'resync' }, { kind: 'change', topic: 'orders', locationId: 'loc-1' }]);
    client.stop();
    expect(client.getStatus()).toBe('offline');
  });

  it('omits the query string without a location', async () => {
    const s = mockStream();
    const { client, fetchImpl } = setup([s]);
    client.start(null);
    await flush();
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('http://api/admin/realtime/stream');
    client.stop();
  });

  it('on expired: refreshes the token and reconnects at once, resyncing again', async () => {
    const a = mockStream();
    const b = mockStream();
    const { client, fetchImpl, refresh, signals } = setup([a, b]);
    client.start(null);
    await flush();
    a.send(hello());
    await flush();
    a.send(frame('expired', {}));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    b.send(hello());
    await flush();
    expect(client.getStatus()).toBe('live');
    expect(signals.filter((x) => x.kind === 'resync')).toHaveLength(2);
    client.stop();
  });

  it('on 401: refreshes once and retries; a repeated 401 backs off instead of looping', async () => {
    const { client, fetchImpl, refresh } = setup([failure(401)]);
    client.start(null);
    await flush();
    // 401 -> refresh -> immediate retry -> 401 again -> refresh -> backoff (500 ms at random=1)
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    client.stop();
  });

  it('on replaced: waits the long back-off before reconnecting', async () => {
    const a = mockStream();
    const b = mockStream();
    const { client, fetchImpl } = setup([a, b], { replacedBackoffMs: 30_000 });
    client.start(null);
    await flush();
    a.send(hello() + frame('replaced', {}));
    await flush();
    expect(client.getStatus()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(29_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_100);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    client.stop();
  });

  it('reconnects with exponential back-off after failures and drops back to reconnecting when a live stream ends', async () => {
    const good = mockStream();
    const { client, fetchImpl } = setup([failure(500), failure(500), good]);
    client.start(null);
    await flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    good.send(hello());
    await flush();
    expect(client.getStatus()).toBe('live');
    good.close();
    await flush();
    expect(client.getStatus()).toBe('reconnecting');
    client.stop();
  });

  it('drops a silent stream (no ping within 2.5 heartbeats) and reconnects', async () => {
    const a = mockStream();
    const b = mockStream();
    const { client, fetchImpl } = setup([a, b]);
    client.start(null);
    await flush();
    a.send(hello());
    await flush();
    await vi.advanceTimersByTimeAsync(51_000);
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
    client.stop();
  });

  it('stop aborts the in-flight request', async () => {
    const s = mockStream();
    const { client, fetchImpl } = setup([s]);
    client.start(null);
    await flush();
    const signal = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].signal as AbortSignal;
    client.stop();
    expect(signal.aborted).toBe(true);
  });
});
