import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import type { ClientSummary } from '../commercial/api';

const listRegistrations = vi.fn();
const getAttention = vi.fn();
vi.mock('../registrations/api', () => ({
  listRegistrations: (...a: unknown[]) => listRegistrations(...a),
  getAttention: (...a: unknown[]) => getAttention(...a),
}));

import { NeedsYouNow } from './NeedsYouNow';

const DAY = 86_400_000;
const client = (over: Partial<ClientSummary>): ClientSummary => ({
  id: 'c',
  name: 'Client',
  slug: null,
  commercialStatus: 'ACTIVE',
  assignedTo: null,
  createdAt: new Date().toISOString(),
  businessType: { key: 'restaurant', name: 'Restaurant' },
  _count: { activationRequests: 0, locations: 1 },
  paidUntil: new Date(Date.now() + 200 * DAY).toISOString(),
  ...over,
});

const widget = (clients: ClientSummary[]) => ({ data: { clients, complete: true }, loading: false, error: null, hidden: false, reload: () => undefined });

function renderIt(clients: ClientSummary[] = []) {
  return render(
    <MemoryRouter>
      <NeedsYouNow clients={widget(clients)} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listRegistrations.mockReset();
  getAttention.mockReset();
});
afterEach(cleanup);

describe('NeedsYouNow (platform Home)', () => {
  it('shows only what is waiting, money problems first, each linking to where it is fixed', async () => {
    listRegistrations.mockResolvedValue({ items: [], total: 13, skip: 0, take: 1 });
    getAttention.mockResolvedValue({
      failedProvisioning: [{ registrationId: 'r1', restaurantName: 'A', lastError: null, currentStep: null }],
      paidNotConverted: [{ registrationId: 'r2', restaurantName: 'B' }],
      mismatch: [{ registrationId: 'r3', restaurantName: 'C' }],
      paidClosed: [],
    });
    renderIt([
      client({ id: '1', name: 'Overdue Cafe', paidUntil: new Date(Date.now() - 3 * DAY).toISOString() }),
      client({ id: '2', name: 'Soon Cafe', paidUntil: new Date(Date.now() + 5 * DAY).toISOString() }),
      client({ id: '3', name: 'Churned Cafe', commercialStatus: 'CHURNED', paidUntil: new Date(Date.now() - 30 * DAY).toISOString() }),
      client({ id: '4', name: 'Fine Cafe' }),
    ]);
    expect(await screen.findByText('13')).toBeTruthy();
    const labels = screen.getAllByRole('link').map((a) => a.textContent ?? '');
    expect(labels[0]).toContain('1 wrong amount paid');
    expect(labels[1]).toContain('1 account could not be created');
    expect(labels.join('|')).toContain('1 paid, no account yet');
    expect(labels.join('|')).toContain('13 new requests');
    expect(labels.join('|')).toContain('1 client is past its paid-until date'); // the churned client is not counted
    expect(labels.join('|')).toContain('1 renewal due in 14 days');
    expect(screen.getAllByRole('link').every((a) => ['/registrations', '/commercial'].includes(a.getAttribute('href') ?? ''))).toBe(true);
  });

  it('says plainly when nothing is waiting', async () => {
    listRegistrations.mockResolvedValue({ items: [], total: 0, skip: 0, take: 1 });
    getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [], mismatch: [], paidClosed: [] });
    renderIt();
    expect(await screen.findByText(/Nothing is waiting on you right now/)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows a retry, not a blank, when the check fails', async () => {
    listRegistrations.mockRejectedValue(new Error('down'));
    getAttention.mockRejectedValue(new Error('down'));
    renderIt();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
