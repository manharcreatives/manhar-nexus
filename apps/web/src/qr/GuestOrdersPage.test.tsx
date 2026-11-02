import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import type { GuestOrder } from './types';

const order = (over: Partial<GuestOrder> = {}): GuestOrder => ({
  id: 'sr-1',
  requestNumber: null,
  status: 'AWAITING_CONFIRMATION',
  tableId: 'tbl-2',
  tableCode: 'T2',
  areaName: 'Main Hall',
  locationId: 'loc-1',
  guestName: 'Asha',
  placedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  note: null,
  rejectReason: null,
  totalMinor: 62000,
  lines: [
    { id: 'l-1', name: 'Paneer Tikka', variantName: null, qty: 2, unitPriceMinor: 28000, addOns: [], note: null, cancelled: false },
    { id: 'l-2', name: 'Dal Makhani', variantName: null, qty: 1, unitPriceMinor: 6000, addOns: [], note: null, cancelled: false },
  ],
  ...over,
});

const err = (status: number, code: string, message = 'nope') => Object.assign(new Error(message), { status, code });

const api = vi.hoisted(() => ({
  pendingOrders: vi.fn(),
  alerts: vi.fn(),
  ackAlert: vi.fn(),
  confirm: vi.fn(),
  reject: vi.fn(),
  edit: vi.fn(),
}));
vi.mock('./api', () => ({ qrApi: api, newIdempotencyKey: () => 'idem-key-0001' }));

import { GuestOrderProvider } from './GuestOrderProvider';
import GuestOrdersPage from './GuestOrdersPage';

function mount() {
  return render(
    <ToastProvider>
      <GuestOrderProvider enabled>
        <GuestOrdersPage />
      </GuestOrderProvider>
    </ToastProvider>,
  );
}

// jsdom has no modal dialog support; emulate the bits the shared Dialog relies on.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __patched?: boolean };
  if (proto.__patched) return;
  proto.__patched = true;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  api.pendingOrders.mockResolvedValue([order()]);
  api.alerts.mockResolvedValue([{ tableId: 'tbl-2', tableCode: 'T2', areaName: null, reason: 'bill', at: new Date().toISOString() }]);
  api.ackAlert.mockResolvedValue(undefined);
  api.confirm.mockResolvedValue(order({ status: 'CONFIRMED' }));
  api.reject.mockResolvedValue(order({ status: 'REJECTED' }));
  api.edit.mockResolvedValue(order());
});

describe('guest-order inbox', () => {
  it('lists waiting orders and open waiter calls', async () => {
    mount();
    expect(await screen.findByRole('article', { name: /table T2/i })).toBeTruthy();
    expect(screen.getByText('Bill requested', { exact: false })).toBeTruthy();
  });

  it('accept confirms by id and takes the order off the list', async () => {
    api.pendingOrders.mockResolvedValueOnce([order()]).mockResolvedValue([]); // the refresh after accepting finds nothing waiting
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Accept the order from table T2/i }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledWith('sr-1'));
    await waitFor(() => expect(screen.queryByRole('article', { name: /table T2/i })).toBeNull());
  });

  it('reject sends the reason', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Reject the order from table T2/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject order/i }));
    await waitFor(() => expect(api.reject).toHaveBeenCalledTimes(1));
    expect(api.reject.mock.calls[0][0]).toBe('sr-1');
    expect(typeof api.reject.mock.calls[0][1]).toBe('string');
  });

  it('a bill that already exists is explained, not reported as "already handled"', async () => {
    api.confirm.mockRejectedValue(err(409, 'ORDERING_LOCKED'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Accept the order from table T2/i }));
    expect((await screen.findAllByText(/A bill already exists for this table/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Another staff member already handled/)).toBeNull();
  });

  it('another waiter got there first: friendly message and a refresh', async () => {
    api.confirm.mockRejectedValue(err(409, 'CONFLICT'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Accept the order from table T2/i }));
    expect((await screen.findAllByText(/Another staff member already handled/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(api.pendingOrders.mock.calls.length).toBeGreaterThan(1));
  });

  it('edit then accept: sends only changed lines, once, even when the accept has to be retried', async () => {
    api.confirm.mockRejectedValueOnce(Object.assign(new Error('offline'), {})).mockResolvedValue(order({ status: 'CONFIRMED' }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Edit the order from table T2/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /One less Dal Makhani/i }));
    const save = within(dialog).getByRole('button', { name: /Save and accept/i });
    fireEvent.click(save);
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    expect(api.edit).toHaveBeenCalledTimes(1);
    expect(api.edit.mock.calls[0][0]).toBe('sr-1');
    expect(api.edit.mock.calls[0][1]).toEqual({ lines: [{ id: 'l-2', qty: 0 }] });
    // the first accept failed (network): try again from the still-open dialog
    await waitFor(() => expect((within(screen.getByRole('dialog')).getByRole('button', { name: /Save and accept/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Save and accept/i }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(2));
    expect(api.edit).toHaveBeenCalledTimes(1);
  });

  it('an edit the server refuses (the order changed meanwhile) reloads the inbox instead of leaving a stale dialog', async () => {
    api.edit.mockRejectedValue(err(400, 'VALIDATION', 'That item is not part of this order.'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Edit the order from table T2/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /One less Dal Makhani/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Save and accept/i }));
    expect((await screen.findAllByText(/changed in the meantime/)).length).toBeGreaterThan(0);
    expect(api.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(api.pendingOrders.mock.calls.length).toBeGreaterThan(1));
  });

  it('acknowledging a waiter request calls the ack endpoint for the table', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Mark the request from table T2 as handled/i }));
    await waitFor(() => expect(api.ackAlert).toHaveBeenCalledWith('tbl-2'));
  });
});
