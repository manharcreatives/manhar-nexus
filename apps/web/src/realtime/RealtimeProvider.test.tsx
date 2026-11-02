import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { LiveBadge } from './LiveBadge';
import { RealtimeClient } from './client';
import { RealtimeProviderCore, useLiveRefresh, useRealtimeTopics } from './RealtimeProvider';
import { change, failure, flush, hello, mockStream } from './testStream';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function makeClient(streams: { response: Response }[]) {
  let i = 0;
  const fetchImpl = vi.fn((..._a: unknown[]) => Promise.resolve(streams[Math.min(i++, streams.length - 1)].response));
  const client = new RealtimeClient({
    baseUrl: 'http://api',
    getToken: () => 'tok',
    refresh: () => Promise.resolve(true),
    fetchImpl: fetchImpl as unknown as typeof fetch,
    random: () => 1,
  });
  return { client, fetchImpl };
}

function Probe({ topics, onChange }: { topics: ('orders' | 'kitchen' | 'invoices')[]; onChange: () => void }) {
  useRealtimeTopics(topics, onChange);
  return null;
}

describe('RealtimeProvider', () => {
  it('hello then a burst of change events calls onChange once per coalesced window; other topics are ignored', async () => {
    const s = mockStream();
    const { client } = makeClient([s]);
    const onChange = vi.fn();
    render(
      <RealtimeProviderCore enabled locationId={null} client={client}>
        <Probe topics={['orders', 'kitchen']} onChange={onChange} />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
      s.send(hello());
      await flush();
      await vi.advanceTimersByTimeAsync(200);
    });
    // the synthetic resync on connect
    expect(onChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      s.send(change('orders') + change('kitchen') + change('orders') + change('invoices'));
      await flush();
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(onChange).toHaveBeenCalledTimes(2);

    await act(async () => {
      s.send(change('invoices'));
      await flush();
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('does not connect when disabled (platform realm / signed out)', async () => {
    const { client, fetchImpl } = makeClient([mockStream()]);
    render(
      <RealtimeProviderCore enabled={false} locationId={null} client={client}>
        <LiveBadge />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reconnects with the new location when it changes, and aborts on unmount', async () => {
    const a = mockStream();
    const b = mockStream();
    const { client, fetchImpl } = makeClient([a, b]);
    const view = render(
      <RealtimeProviderCore enabled locationId="l1" client={client}>
        <LiveBadge />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toContain('locationId=l1');
    const firstSignal = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].signal as AbortSignal;
    view.rerender(
      <RealtimeProviderCore enabled locationId="l2" client={client}>
        <LiveBadge />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    expect(firstSignal.aborted).toBe(true);
    expect((fetchImpl.mock.calls[1] as unknown as [string])[0]).toContain('locationId=l2');
    const secondSignal = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].signal as AbortSignal;
    view.unmount();
    expect(secondSignal.aborted).toBe(true);
  });

  it('LiveBadge reflects live, reconnecting and offline states in a polite status region', async () => {
    const s = mockStream();
    const { client } = makeClient([s, failure(500)]);
    render(
      <RealtimeProviderCore enabled locationId={null} client={client}>
        <LiveBadge />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    const badge = screen.getByRole('status');
    expect(badge.getAttribute('aria-live')).toBe('polite');
    expect(badge.textContent).toBe('Connecting…');
    await act(async () => {
      s.send(hello());
      await flush();
    });
    expect(badge.textContent).toBe('Live');
    await act(async () => {
      s.close();
      await flush();
    });
    expect(badge.textContent).toBe('Reconnecting…');
  });

  it('polling mode shows a polling badge and refetches every 10 s without SSE', async () => {
    const load = vi.fn();
    function Page() {
      useLiveRefresh(['orders'], load);
      return null;
    }
    render(
      <RealtimeProviderCore enabled locationId={null} mode="poll">
        <LiveBadge />
        <Page />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    expect(screen.getByRole('status').textContent).toBe('Live · 10s');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('safety-net poll: every 60 s while live, every 15 s otherwise', async () => {
    const s = mockStream();
    const { client } = makeClient([s]);
    const load = vi.fn();
    function Page() {
      useLiveRefresh(['orders'], load);
      return null;
    }
    render(
      <RealtimeProviderCore enabled locationId={null} client={client}>
        <Page />
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    // not live yet: degraded 15 s cadence
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      s.send(hello());
      await flush();
      await vi.advanceTimersByTimeAsync(200); // resync
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(load).toHaveBeenCalledTimes(3);
  });
});
