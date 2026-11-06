import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { autopayToken, isAutopayPath } from '../autopay/path';
import type { RegistrationRequest } from './api';
import type { Subscription } from './subscriptionApi';

const request: RegistrationRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  referenceCode: 'NX-7K2Q9M',
  status: 'NEW',
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+919714571522',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: 1,
  planKey: 'counter',
  billingCycle: 'monthly',
  message: null,
  assignedTo: null,
  internalNotes: null,
  businessId: null,
  payments: [],
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's-1',
  registrationId: request.id,
  subscriptionId: 'NX-7K2Q9M-ap-1234abcd',
  status: 'INITIALIZED',
  planKey: 'counter',
  amountPaise: 70_682,
  breakdown: null,
  firstChargeAt: null,
  activatedAt: null,
  cancelledAt: null,
  lastChargeStatus: null,
  lastChargeAt: null,
  authPath: '/pay/autopay/tok_abcdefghijklmnop',
  createdAt: '2026-11-05T10:00:00.000Z',
  charges: [],
  ...over,
});

const listSubscriptions = vi.fn();
const createSubscription = vi.fn();
const cancelSubscription = vi.fn();
const refreshSubscription = vi.fn();
vi.mock('./subscriptionApi', async (orig) => ({
  ...(await orig<typeof import('./subscriptionApi')>()),
  listSubscriptions: (...a: unknown[]) => listSubscriptions(...a),
  createSubscription: (...a: unknown[]) => createSubscription(...a),
  cancelSubscription: (...a: unknown[]) => cancelSubscription(...a),
  refreshSubscription: (...a: unknown[]) => refreshSubscription(...a),
}));

import { AutopayDialog } from './AutopayDialog';

beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  for (const m of [listSubscriptions, createSubscription, cancelSubscription, refreshSubscription]) m.mockReset();
  listSubscriptions.mockResolvedValue([]);
});

const open = (req: RegistrationRequest = request) => render(<AutopayDialog request={req} onClose={() => undefined} />);

describe('AutopayDialog', () => {
  it('with no mandate yet, creates one for the request plan without sending any price', async () => {
    createSubscription.mockResolvedValue(sub());
    open();
    expect(await screen.findByText('No AutoPay mandate yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create AutoPay link' }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalledWith(request.id, { planKey: 'counter' }));
  });

  it('a request with no fixed plan must have one chosen first', async () => {
    open({ ...request, planKey: 'not-sure' });
    const create = await screen.findByRole('button', { name: 'Create AutoPay link' });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'floor' } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Create AutoPay link' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('shows the amount, status and the owner link actions for a waiting mandate; replacing needs the tick', async () => {
    listSubscriptions.mockResolvedValue([sub()]);
    createSubscription.mockResolvedValue(sub({ id: 's-2' }));
    open();
    expect(await screen.findByText('Waiting for the owner')).toBeTruthy();
    expect(screen.getByText(/₹706\.82 a month/)).toBeTruthy();
    const wa = screen.getByRole('link', { name: 'WhatsApp the owner' });
    expect(decodeURIComponent(wa.getAttribute('href') ?? '')).toContain('/pay/autopay/tok_abcdefghijklmnop');
    const create = screen.getByRole('button', { name: 'Create AutoPay link' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Cancel it and create this new one/));
    fireEvent.click(screen.getByRole('button', { name: 'Create AutoPay link' }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalledWith(request.id, { planKey: 'counter', replaceOpen: true }));
  });

  it('an active mandate cannot be replaced: no create button, but Check and Cancel work', async () => {
    listSubscriptions.mockResolvedValue([sub({ status: 'ACTIVE', authPath: null, lastChargeStatus: 'SUCCESS', lastChargeAt: '2026-11-07T00:00:00.000Z' })]);
    refreshSubscription.mockResolvedValue({ outcome: 'ignored', subscription: sub({ status: 'ACTIVE' }) });
    cancelSubscription.mockResolvedValue(sub({ status: 'CANCELLED' }));
    open();
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create AutoPay link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
    await waitFor(() => expect(refreshSubscription).toHaveBeenCalledWith(request.id, 's-1'));
    expect(await screen.findByText('No change at Cashfree yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel AutoPay' }));
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledWith(request.id, 's-1'));
  });

  it('warns when a debit came in for the wrong amount', async () => {
    listSubscriptions.mockResolvedValue([sub({ status: 'ACTIVE', authPath: null, lastChargeStatus: 'AMOUNT_MISMATCH' })]);
    open();
    expect(await screen.findByText(/different amount than the plan price/)).toBeTruthy();
  });

  it("shows the server's plain message when AutoPay is not switched on (503)", async () => {
    createSubscription.mockRejectedValue(Object.assign(new Error('AutoPay is not switched on for this server yet.'), { status: 503 }));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Create AutoPay link' }));
    expect(await screen.findByText(/not switched on for this server yet/)).toBeTruthy();
  });
});

describe('autopay path helpers', () => {
  it('extracts the token only from /pay/autopay/<token>', () => {
    expect(autopayToken('/pay/autopay/tok_abcdefghijklmnop')).toBe('tok_abcdefghijklmnop');
    expect(autopayToken('/pay/autopay/tok_abcdefghijklmnop/')).toBe('tok_abcdefghijklmnop');
    expect(autopayToken('/pay/autopay/')).toBeNull();
    expect(autopayToken('/pay/autopay/short')).toBeNull();
    expect(autopayToken('/m/tok_abcdefghijklmnop')).toBeNull();
    expect(isAutopayPath('/pay/autopay/x')).toBe(true);
    expect(isAutopayPath('/pay')).toBe(false);
    expect(isAutopayPath('/payroll')).toBe(false);
  });
});
