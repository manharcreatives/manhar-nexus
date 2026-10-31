import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { SessionPanel } from './SessionPanel';
import { orderApi, sessionApi } from './api';
import type { DiningTable, GuestSession, ServiceRequest } from './api';
import { orderEditApi } from './order/orderEditApi';
import { MENU_CATEGORIES, MENU_ITEMS, line, makeOrder, patchDialog } from './order/testFixtures';

const roles = vi.hoisted(() => ({ current: ['service-team'] }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { realm: 'BUSINESS', roles: roles.current.map((key) => ({ key, name: key })) } }),
}));
vi.mock('./CheckoutDialog', () => ({ CheckoutDialog: () => null }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  orderApi: { list: vi.fn(), get: vi.fn(), cancel: vi.fn(), serve: vi.fn() },
  sessionApi: { close: vi.fn() },
  catalogApi: { listModifierGroups: vi.fn(() => Promise.resolve([])) },
}));
vi.mock('./order/orderEditApi', async (orig) => ({
  ...(await orig<typeof import('./order/orderEditApi')>()),
  orderEditApi: { edit: vi.fn(), state: vi.fn() },
}));

patchDialog();

const session = { id: 's-1', partySize: 2, openedAt: new Date().toISOString() } as GuestSession;
const table = { id: 't-1', code: 'T4' } as DiningTable;

function show(orders: ServiceRequest[]) {
  vi.mocked(orderApi.list).mockResolvedValue(orders);
  render(
    <ToastProvider>
      <SessionPanel session={session} table={table} categories={MENU_CATEGORIES} items={MENU_ITEMS} onClose={vi.fn()} onRefresh={vi.fn()} />
    </ToastProvider>,
  );
}
const editButton = async (round = 1) => screen.findByRole('button', { name: new RegExp(`^Edit order, Round ${round}$`) }) as Promise<HTMLButtonElement>;

beforeEach(() => {
  roles.current = ['service-team'];
  vi.mocked(sessionApi.close).mockReset();
  vi.mocked(orderApi.get).mockReset().mockResolvedValue(makeOrder());
  vi.mocked(orderEditApi.state).mockReset().mockResolvedValue({ editable: { allowed: true }, edits: [] });
});
afterEach(cleanup);

describe('SessionPanel: Edit order', () => {
  it('is offered, enabled, on a sent order the kitchen has not started, and opens the edit dialog', async () => {
    show([makeOrder()]);
    const btn = await editButton();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Edit order');
    fireEvent.click(btn);
    expect(await screen.findByRole('region', { name: 'Added to order' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Edit Round 1 - table T4' })).toBeTruthy();
    expect(orderEditApi.state).toHaveBeenCalledWith('o-1');
  });

  it('is also available on a draft that was never sent', async () => {
    show([makeOrder({ status: 'DRAFT' })]);
    expect((await editButton()).disabled).toBe(false);
  });

  it.each([
    ['ACCEPTED', /kitchen has started this order/],
    ['PREPARING', /kitchen has started this order/],
    ['READY', /kitchen has started this order/],
    ['SERVED', /has been served/],
  ] as const)('is disabled with a clear reason once the order is %s', async (status, reason) => {
    show([makeOrder({ status })]);
    const btn = await editButton();
    expect(btn.disabled).toBe(true);
    const why = screen.getByText(reason);
    expect(btn.getAttribute('aria-describedby')).toBe(why.id);
    fireEvent.click(btn);
    expect(screen.queryByRole('region', { name: 'Added to order' })).toBeNull();
  });

  it('a partially accepted order (still SENT, one line already preparing) counts as started', async () => {
    show([makeOrder({ lines: [line('l-1', 'Dosa', 1, 100, { status: 'PREPARING' }), line('l-2', 'Tea', 1, 50)] })]);
    expect((await editButton()).disabled).toBe(true);
    expect(screen.getByText(/kitchen has started this order/)).toBeTruthy();
  });

  it('is not shown on a cancelled order (nothing left to edit)', async () => {
    show([makeOrder({ status: 'CANCELLED' })]);
    await screen.findByText('Round 1');
    expect(screen.queryByRole('button', { name: /Edit order/ })).toBeNull();
  });

  it.each(['kitchen-team', 'host', 'checkout-associate'])('is hidden from %s (no restaurant.order.edit permission)', async (role) => {
    roles.current = [role];
    show([makeOrder()]);
    await screen.findByText('Round 1');
    expect(screen.queryByRole('button', { name: /Edit order/ })).toBeNull();
  });

  it.each(['service-team', 'location-manager', 'owner'])('is shown to %s', async (role) => {
    roles.current = [role];
    show([makeOrder()]);
    expect(await editButton()).toBeTruthy();
  });

  it('marks edited orders and the lines an edit added or changed', async () => {
    show([makeOrder({ editCount: 2, lines: [line('l-1', 'Masala Dosa', 3, 14000, { editKind: 'CHANGED', notes: 'extra crispy' }), line('l-2', 'Lassi', 1, 9000, { editKind: 'ADDED' })] })]);
    await editButton();
    expect(screen.getByText('Edited')).toBeTruthy();
    expect(screen.getByText('Changed')).toBeTruthy();
    expect(screen.getByText('Added')).toBeTruthy();
    expect(screen.getByText(/extra crispy/)).toBeTruthy();
  });

  it('after a successful save the card shows the updated order without a reload', async () => {
    show([makeOrder()]);
    fireEvent.click(await editButton());
    const added = await screen.findByRole('region', { name: 'Added to order' });
    const updated = makeOrder({ version: 4, editCount: 1, lines: [line('l-1', 'Masala Dosa', 3, 14000, { editKind: 'CHANGED' }), makeOrder().lines[1] as never] });
    vi.mocked(orderEditApi.edit).mockResolvedValue({ ...updated, edit: { id: 'e', editNumber: 1, replayed: false } });
    vi.mocked(orderApi.list).mockResolvedValue([updated]);
    fireEvent.click(within(added).getByRole('button', { name: 'Add one Masala Dosa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Added to order' })).toBeNull());
    expect(await screen.findByText('Edited')).toBeTruthy();
    expect(screen.getByText('3×')).toBeTruthy();
  });
});
