import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { RealtimeClient } from '../realtime/client';
import { RealtimeProviderCore } from '../realtime/RealtimeProvider';
import { change, flush, hello, mockStream } from '../realtime/testStream';
import { KitchenPage } from './KitchenPage';
import { kitchenApi } from './api';
import type { ServiceRequest } from './api';

const queue = vi.hoisted(() => ({ current: [] as ServiceRequest[] }));
const roles = vi.hoisted(() => ({ current: ['kitchen-team'] }));

vi.mock('../context/LocationContext', () => ({ useWorkLocation: () => ({ locationId: 'loc-1' }) }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { realm: 'BUSINESS', roles: roles.current.map((key) => ({ key, name: key })) } }),
}));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  kitchenApi: { queue: vi.fn(() => Promise.resolve(queue.current)), accept: vi.fn(), prepare: vi.fn(), ready: vi.fn() },
  diningApi: { listTables: vi.fn(() => Promise.resolve([])) },
  sessionApi: { list: vi.fn(() => Promise.resolve([])) },
}));

const ticket = (id: string, n: string): ServiceRequest => ({
  id,
  sessionId: `s-${id}`,
  roundNumber: 1,
  requestNumber: n,
  status: 'SENT',
  sentAt: new Date().toISOString(),
  notes: null,
  lines: [
    {
      id: `l-${id}`,
      catalogItemId: 'c',
      itemNameSnapshot: 'Dal Makhani',
      variantNameSnapshot: null,
      quantity: 2,
      unitPriceMinorUnits: 15000,
      taxRateSnapshot: 5,
      modifiers: [],
      notes: null,
      status: 'PENDING',
    },
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  roles.current = ['kitchen-team'];
  vi.mocked(kitchenApi.queue).mockClear();
});
afterEach(() => vi.useRealTimers());

describe('KitchenPage arrival highlight', () => {
  it('washes only tickets that arrive after the first load, then clears the wash', async () => {
    queue.current = [ticket('a', 'K-1')];
    render(
      <ToastProvider>
        <KitchenPage />
      </ToastProvider>,
    );
    const first = await screen.findByRole('article', { name: /K-1|Round 1/ });
    expect(first.className).not.toContain('nx-arriving');

    queue.current = [ticket('a', 'K-1'), ticket('b', 'K-2')];
    // No realtime provider here: the safety-net poll runs every 15 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles.filter((a) => a.className.includes('nx-arriving'))).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    expect(screen.getAllByRole('article').filter((a) => a.className.includes('nx-arriving'))).toHaveLength(0);
  });
});

describe('KitchenPage realtime', () => {
  it('a burst of order/kitchen events reloads the queue once, and a ticket that arrives that way is highlighted', async () => {
    queue.current = [ticket('a', 'K-1')];
    const stream = mockStream();
    const client = new RealtimeClient({
      baseUrl: 'http://api',
      getToken: () => 'tok',
      refresh: () => Promise.resolve(true),
      fetchImpl: (() => Promise.resolve(stream.response)) as unknown as typeof fetch,
    });
    render(
      <RealtimeProviderCore enabled locationId="loc-1" client={client}>
        <ToastProvider>
          <KitchenPage />
        </ToastProvider>
      </RealtimeProviderCore>,
    );
    await act(async () => {
      await flush();
    });
    await screen.findByRole('article', { name: /K-1|Round 1/ });
    await act(async () => {
      stream.send(hello());
      await flush();
      await vi.advanceTimersByTimeAsync(400); // resync reload
    });
    const before = vi.mocked(kitchenApi.queue).mock.calls.length;

    queue.current = [ticket('a', 'K-1'), ticket('b', 'K-2')];
    await act(async () => {
      stream.send(change('orders') + change('kitchen') + change('orders'));
      await flush();
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(vi.mocked(kitchenApi.queue).mock.calls.length - before).toBe(1);
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles.filter((a) => a.className.includes('nx-arriving'))).toHaveLength(1);
    client.stop();
  });
});

describe('KitchenPage roles', () => {
  it('shows the action button to kitchen staff', async () => {
    queue.current = [ticket('a', 'K-1')];
    render(
      <ToastProvider>
        <KitchenPage />
      </ToastProvider>,
    );
    await screen.findByRole('article', { name: /K-1|Round 1/ });
    expect(screen.getByRole('button', { name: /Accept/i })).toBeTruthy();
    expect(screen.queryByText(/View only/)).toBeNull();
  });

  it('is read-only for waiters: tickets and status visible, no action buttons, a quiet note', async () => {
    roles.current = ['service-team'];
    queue.current = [ticket('a', 'K-1')];
    render(
      <ToastProvider>
        <KitchenPage />
      </ToastProvider>,
    );
    await screen.findByRole('article', { name: /K-1|Round 1/ });
    expect(screen.queryByRole('button', { name: /Accept|Start|Ready/i })).toBeNull();
    expect(screen.getByText(/View only/)).toBeTruthy();
    expect(screen.getByText('Dal Makhani')).toBeTruthy();
  });
});
