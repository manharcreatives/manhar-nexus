import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { RevenueHero } from './RevenueHero';
import { OpsWidgets } from './OpsWidgets';
import { addDaysIso, todayIso } from '../reports/dates';

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

const point = (date: string, net: number, count: number) => ({
  date,
  paidInvoiceCount: count,
  grossSalesMinorUnits: net,
  totalRevenueMinorUnits: net,
  totalRefundedMinorUnits: 0,
  netRevenueMinorUnits: net,
});

afterEach(() => vi.unstubAllGlobals());

describe('RevenueHero', () => {
  const stub = (lastWeekNet: number, todayNet: number) => {
    const today = todayIso();
    const days = Array.from({ length: 8 }, (_, i) => point(addDaysIso(today, i - 7), i === 0 ? lastWeekNet : i === 7 ? todayNet : 50000, 3));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ from: days[0].date, to: today, businessId: 'b', timezone: 'UTC', days })),
    );
  };

  it('shows today beside the full total of the same weekday last week as a neutral reference, never as up or down', async () => {
    stub(400000, 100000);
    render(<RevenueHero withSeries locationId={null} />);
    // Hero figure plus the strip's table cell for today.
    expect((await screen.findAllByText('₹1,000.00')).length).toBe(2);
    expect(screen.getByText(/total$/)).toBeTruthy();
    expect(screen.getByText('₹4,000.00')).toBeTruthy();
    expect(screen.getAllByText('Today is 25% of that so far').length).toBeGreaterThan(0);
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('25');
    expect(screen.queryByText(/^(Up|Down) /)).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(7);
  });

  it('says plainly when the reference day had no sales instead of inventing a percentage', async () => {
    stub(0, 100000);
    render(<RevenueHero withSeries locationId={null} />);
    expect(await screen.findByText('Nothing was sold that day to measure against.')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
  });
});

describe('OpsWidgets', () => {
  it('keeps the other widgets when one source fails, and hides a forbidden one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/admin/dining/tables'))
          return json([
            { id: '1', status: 'OCCUPIED', isActive: true, locationId: 'l' },
            { id: '2', status: 'AVAILABLE', isActive: true, locationId: 'l' },
          ]);
        if (url.includes('/admin/kitchen')) return json({ error: { message: 'boom' } }, 500);
        if (url.includes('/admin/costs')) return json({ error: { code: 'MODULE_DISABLED' } }, 403);
        if (url.includes('/admin/notifications')) return json({ notifications: [], totalUnread: 0 });
        return json({}, 404);
      }),
    );
    render(
      <MemoryRouter>
        <OpsWidgets
          locationId={null}
          access={{ tables: true, kitchen: true, expenses: true, alerts: true, links: { tables: true, kitchen: true, costs: true } }}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByText('1 table occupied')).toBeTruthy();
    expect(await screen.findByText("You're all caught up")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("This didn't load"));
    expect(screen.queryByText('Expense approvals')).toBeNull();
  });
});
