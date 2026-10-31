import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ToastProvider } from '../../ui/Toast';
import { KitchenPage } from '../KitchenPage';
import type { ServiceRequest } from '../api';
import { timelineApi } from './timelineApi';

vi.mock('../../context/LocationContext', () => ({ useWorkLocation: () => ({ locationId: 'loc-1' }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { realm: 'BUSINESS', roles: [{ key: 'kitchen-team', name: 'Kitchen' }] } }) }));
const queue = vi.hoisted(() => ({ current: [] as ServiceRequest[] }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  kitchenApi: { queue: vi.fn(() => Promise.resolve(queue.current)), accept: vi.fn(), prepare: vi.fn(), ready: vi.fn() },
  diningApi: { listTables: vi.fn(() => Promise.resolve([])) },
  sessionApi: { list: vi.fn(() => Promise.resolve([])) },
}));
vi.mock('./timelineApi', async (orig) => ({ ...(await orig<typeof import('./timelineApi')>()), timelineApi: { get: vi.fn() } }));

afterEach(cleanup);

describe('Kitchen ticket elapsed label', () => {
  it('shows a small clickable "ago" label on each ticket that opens that order\'s timeline', async () => {
    queue.current = [
      {
        id: 'o-9',
        sessionId: 's-9',
        roundNumber: 1,
        requestNumber: 'K-9',
        status: 'PREPARING',
        sentAt: new Date(Date.now() - 12 * 60_000).toISOString(),
        notes: null,
        lines: [],
      },
    ];
    vi.mocked(timelineApi.get).mockResolvedValue({
      steps: [],
      finished: false,
      startedAt: null,
      endedAt: null,
      totalMs: 0,
      order: { id: 'o-9', status: 'PREPARING', roundNumber: 1, requestNumber: 'K-9', sentAt: null },
      serverTime: new Date().toISOString(),
    });
    render(
      <ToastProvider>
        <KitchenPage />
      </ToastProvider>,
    );
    const chip = await screen.findByRole('button', { name: /show order timeline/i });
    expect(chip.textContent).toContain('12 min ago');
    fireEvent.click(chip);
    expect(await screen.findByRole('dialog', { name: 'Order timeline' })).toBeTruthy();
    expect(timelineApi.get).toHaveBeenCalledWith('o-9');
  });
});
