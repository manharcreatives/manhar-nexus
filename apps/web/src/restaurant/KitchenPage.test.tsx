import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { KitchenPage } from './KitchenPage';
import type { ServiceRequest } from './api';

const queue = vi.hoisted(() => ({ current: [] as ServiceRequest[] }));

vi.mock('../context/LocationContext', () => ({ useWorkLocation: () => ({ locationId: 'loc-1' }) }));
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

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
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
