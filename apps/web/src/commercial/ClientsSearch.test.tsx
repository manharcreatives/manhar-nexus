import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import type { ClientSummary } from './api';

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
  planKey: 'floor',
  billingCycle: 'yearly',
  paidUntil: new Date(Date.now() + 200 * DAY).toISOString(),
  billingSource: 'LINK',
  ...over,
});

const rows = [
  client({ id: '1', name: 'Sweet Tooth Bakery', planKey: 'counter', paidUntil: new Date(Date.now() - 3 * DAY).toISOString() }),
  client({ id: '2', name: 'Gujarati Thali House', paidUntil: new Date(Date.now() + 6 * DAY).toISOString() }),
  client({ id: '3', name: 'Spice Route Kitchen', planKey: 'pass' }),
  client({ id: '4', name: 'Left Us Cafe', commercialStatus: 'CHURNED', paidUntil: new Date(Date.now() - 40 * DAY).toISOString() }),
];

const listClients = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listClients: (...a: unknown[]) => listClients(...a),
}));

import { ClientsPage } from './ClientsPage';

function renderPage() {
  return render(
    <ToastProvider>
      <ClientsPage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  listClients.mockReset();
  listClients.mockResolvedValue(rows);
});
afterEach(cleanup);

describe('Clients list', () => {
  it('finds a client by name or plan, and says so when nothing matches', async () => {
    renderPage();
    await screen.findAllByText('Sweet Tooth Bakery');
    const box = screen.getByRole('searchbox', { name: 'Search clients' });
    fireEvent.change(box, { target: { value: 'thali' } });
    expect(screen.getAllByText('Gujarati Thali House').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Sweet Tooth Bakery')).toHaveLength(0);
    fireEvent.change(box, { target: { value: 'pass' } });
    expect(screen.getAllByText('Spice Route Kitchen').length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: 'nobody-here' } });
    expect(await screen.findByText('No clients match')).toBeTruthy();
  });

  it('"Renewals due or overdue" lists the soonest-due first and leaves out churned clients', async () => {
    renderPage();
    await screen.findAllByText('Sweet Tooth Bakery');
    fireEvent.click(screen.getByLabelText('Renewals due or overdue'));
    const table = screen.getByRole('table');
    const order = within(table)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(order).toEqual(['Sweet Tooth Bakery', 'Gujarati Thali House']);
  });

  it('says how soon a renewal is, in words, beside the paid-until date', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Paid until passed 3 days ago')).toBeTruthy();
    expect(within(table).getByText('Renews in 6 days')).toBeTruthy();
  });

  it('gives phones one card per client next to the table that desktops use', async () => {
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Client accounts' });
    expect(within(list).getAllByRole('button')).toHaveLength(4);
  });
});
