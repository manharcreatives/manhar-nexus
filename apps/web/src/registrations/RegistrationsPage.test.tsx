import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import type { PaymentLink, RegistrationRequest } from './api';

const row: RegistrationRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  referenceCode: 'NX-7K2Q9M',
  status: 'NEW',
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+919714571522',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: 2,
  planKey: 'not-sure',
  billingCycle: 'yearly',
  message: null,
  assignedTo: null,
  internalNotes: null,
  businessId: null,
  payments: [],
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

const listRegistrations = vi.fn();
const updateRegistration = vi.fn();
const createPaymentLink = vi.fn();
const refreshPaymentLink = vi.fn();
const provisionRegistration = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listRegistrations: (...a: unknown[]) => listRegistrations(...a),
  updateRegistration: (...a: unknown[]) => updateRegistration(...a),
  createPaymentLink: (...a: unknown[]) => createPaymentLink(...a),
  refreshPaymentLink: (...a: unknown[]) => refreshPaymentLink(...a),
  provisionRegistration: (...a: unknown[]) => provisionRegistration(...a),
}));

import { RegistrationsPage } from './RegistrationsPage';

function renderPage() {
  return render(
    <ToastProvider>
      <RegistrationsPage />
    </ToastProvider>,
  );
}

const link = (over: Partial<PaymentLink> = {}): PaymentLink => ({
  id: 'p-1',
  registrationId: row.id,
  linkId: 'NX-7K2Q9M-ab12cd34',
  linkUrl: 'https://payments-test.cashfree.com/links/abc',
  amountPaise: 150_000,
  currency: 'INR',
  purpose: 'Manhar Nexus subscription',
  status: 'CREATED',
  paidAmountPaise: null,
  expiresAt: '2099-01-01T00:00:00.000Z',
  paidAt: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  ...over,
});

/** The "open" tab shows NEW, CONTACTED and QUALIFIED requests; these rows come back under NEW. */
function withRows(...rows: RegistrationRequest[]): void {
  listRegistrations.mockImplementation(({ status }: { status: string }) =>
    Promise.resolve({ items: status === 'NEW' ? rows : [], total: rows.length, skip: 0, take: 100 }),
  );
}

// jsdom has no modal dialog support; emulate the bits the shared Dialog relies on.
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
  listRegistrations.mockReset();
  updateRegistration.mockReset();
  createPaymentLink.mockReset();
  refreshPaymentLink.mockReset();
  provisionRegistration.mockReset();
  withRows(row);
});

describe('RegistrationsPage', () => {
  it('lists open requests with the reference code and contact details', async () => {
    renderPage();
    expect(await screen.findByText('Ananda Cafe')).toBeTruthy();
    expect(screen.getByText('NX-7K2Q9M')).toBeTruthy();
    expect(screen.getByText('+919714571522')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create restaurant account' })).toBeTruthy();
  });

  it('opens the create dialog prefilled from the request', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create restaurant account' }));
    expect((await screen.findByDisplayValue('Ananda Cafe')) as HTMLInputElement).toBeTruthy();
    expect(screen.getByDisplayValue('Asha Patel')).toBeTruthy();
    expect(screen.getByDisplayValue('asha@example.com')).toBeTruthy();
  });

  it('marks a request contacted through the API', async () => {
    updateRegistration.mockResolvedValue({ ...row, status: 'CONTACTED' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark contacted' }));
    await waitFor(() => expect(updateRegistration).toHaveBeenCalledWith(row.id, { status: 'CONTACTED' }));
  });

  it('shows an error state with retry when loading fails', async () => {
    listRegistrations.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText('Could not load requests')).toBeTruthy();
  });
});

describe('RegistrationsPage: owner payment (Cashfree link)', () => {
  it('offers "Send payment link" for a live request, next to creating the account', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Send payment link' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create restaurant account' })).toBeTruthy();
  });

  it('prices from the plan: shows the breakdown and sends only the plan, never an amount', async () => {
    createPaymentLink.mockResolvedValue(link({ amountPaise: 1_149_320 }));
    withRows({ ...row, planKey: 'floor', billingCycle: 'yearly', createdAt: '2026-12-01T10:00:00.000Z' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send payment link' }));
    expect(await screen.findByText('Founding Restaurants offer (25% off the first year)')).toBeTruthy();
    expect(screen.getByText('₹11,493.20')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(createPaymentLink).toHaveBeenCalledWith(row.id, { planKey: 'floor', cycle: 'yearly', launchPack: false }));
  });

  it('a "not sure" request needs a plan chosen before a link can be made', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send payment link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create link' }));
    expect(await screen.findByText('Choose a plan first, or type an amount.')).toBeTruthy();
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it('a typed amount needs a reason and sends both', async () => {
    createPaymentLink.mockResolvedValue(link());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send payment link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Type an amount instead' }));
    fireEvent.change(await screen.findByLabelText(/Amount/), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText(/Write a short reason/)).toBeTruthy();
    expect(createPaymentLink).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Why a different amount/), { target: { value: 'agreed on the phone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(createPaymentLink).toHaveBeenCalledWith(row.id, { amountRupees: 1500, overrideReason: 'agreed on the phone' }));
  });

  it('with an open link, offers to replace it and sends replaceOpen only when ticked', async () => {
    createPaymentLink.mockResolvedValue(link());
    withRows({ ...row, planKey: 'counter', billingCycle: 'monthly', payments: [link()] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    fireEvent.click(await screen.findByLabelText(/Cancel it and create this new one/));
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() =>
      expect(createPaymentLink).toHaveBeenCalledWith(row.id, { planKey: 'counter', cycle: 'monthly', launchPack: false, replaceOpen: true }),
    );
  });

  it('rejects a bad amount in the dialog without calling the API', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send payment link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Type an amount instead' }));
    const amount = await screen.findByLabelText(/Amount/);
    for (const bad of ['', '0', 'abc', '10.001', '-5']) {
      fireEvent.change(amount, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
      expect(await screen.findByText(/above ₹0 with at most two decimals/)).toBeTruthy();
    }
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it('creates the link for the typed amount and shows it to copy or WhatsApp to the owner', async () => {
    createPaymentLink.mockResolvedValue(link());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send payment link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Type an amount instead' }));
    fireEvent.change(await screen.findByLabelText(/Amount/), { target: { value: '₹1,500' } });
    fireEvent.change(screen.getByLabelText(/Why a different amount/), { target: { value: 'custom deal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(createPaymentLink).toHaveBeenCalledWith(row.id, { amountRupees: 1500, overrideReason: 'custom deal' }));
    expect(await screen.findByText('https://payments-test.cashfree.com/links/abc')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    const wa = screen.getByRole('link', { name: 'WhatsApp the owner' });
    expect(wa.getAttribute('href')).toContain('https://wa.me/919714571522?text=');
    expect(decodeURIComponent(wa.getAttribute('href') ?? '')).toContain('https://payments-test.cashfree.com/links/abc');
  });

  it("shows the server's plain message when Cashfree is not set up (503)", async () => {
    createPaymentLink.mockRejectedValue(
      Object.assign(new Error('Online payments are not set up on this server yet (Cashfree keys missing).'), { status: 503 }),
    );
    withRows({ ...row, planKey: 'counter', billingCycle: 'monthly' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send payment link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText(/not set up on this server yet/)).toBeTruthy();
  });

  it('lists payment links with their status and links to the open one', async () => {
    withRows({ ...row, payments: [link()] });
    renderPage();
    expect(await screen.findByText('Awaiting payment')).toBeTruthy();
    expect(screen.getByText(/₹1,500/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('https://payments-test.cashfree.com/links/abc');
    expect(screen.getByRole('button', { name: 'New payment link' })).toBeTruthy();
  });

  it('once paid: says so, points at creating the account, and stops offering more payment links', async () => {
    withRows({ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID', paidAt: '2026-11-05T11:00:00.000Z', paidAmountPaise: 150_000 })] });
    listRegistrations.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({
        items: status === 'QUALIFIED' ? [{ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID', paidAmountPaise: 150_000 })] }] : [],
        total: 1,
        skip: 0,
        take: 100,
      }),
    );
    renderPage();
    expect(await screen.findByText('Paid. Create the restaurant account now.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /payment link/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create restaurant account' })).toBeTruthy();
  });

  it('"Check payment" asks Cashfree directly and tells staff the result', async () => {
    withRows({ ...row, payments: [link()] });
    refreshPaymentLink.mockResolvedValue({ outcome: 'ignored', payment: link() });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check payment' }));
    await waitFor(() => expect(refreshPaymentLink).toHaveBeenCalledWith(row.id, 'p-1'));
    expect((await screen.findAllByText('Not paid yet.')).length).toBeGreaterThan(0);
  });

  it('"Check payment" announces a payment that came in', async () => {
    withRows({ ...row, payments: [link()] });
    refreshPaymentLink.mockResolvedValue({ outcome: 'updated', payment: link({ status: 'PAID' }) });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check payment' }));
    expect((await screen.findAllByText('Payment received. Create the restaurant account now.')).length).toBeGreaterThan(0);
  });

  it('"Check payment" shows the server message when Cashfree is unreachable (502)', async () => {
    withRows({ ...row, payments: [link()] });
    refreshPaymentLink.mockRejectedValue(Object.assign(new Error('Could not reach Cashfree. Please try again in a moment.'), { status: 502 }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check payment' }));
    expect((await screen.findAllByText('Could not reach Cashfree. Please try again in a moment.')).length).toBeGreaterThan(0);
  });

  it('a paid link has no "Check payment" button', async () => {
    listRegistrations.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ items: status === 'QUALIFIED' ? [{ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID' })] }] : [], total: 1, skip: 0, take: 100 }),
    );
    renderPage();
    await screen.findByText('Paid. Create the restaurant account now.');
    expect(screen.queryByRole('button', { name: 'Check payment' })).toBeNull();
  });

  it('flags a payment whose amount did not match, and does not hide it', async () => {
    withRows({ ...row, payments: [link({ status: 'AMOUNT_MISMATCH', paidAmountPaise: 100 })] });
    renderPage();
    expect(await screen.findByText('Check amount')).toBeTruthy();
    expect(screen.queryByText('Paid. Create the restaurant account now.')).toBeNull();
  });
});

const STEPS = ['business', 'location', 'owner', 'module:restaurant', 'commercial', 'onboarding', 'finalize'];
const steps = (upTo: number, failAt = -1) =>
  STEPS.map((id, i) => ({ id, state: i === failAt ? 'failed' : i < upTo ? 'done' : 'pending' }));

describe('RegistrationsPage: create the restaurant account (server-side job)', () => {
  it('an unpaid request needs the free-pilot box ticked; nothing is sent until then', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create restaurant account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Wait for the payment, or tick the free pilot option.')).toBeTruthy();
    expect(provisionRegistration).not.toHaveBeenCalled();
    provisionRegistration.mockResolvedValue({ status: 'DONE', steps: steps(7), failedStep: null, error: null, businessId: 'b-1', ownerEmail: row.email, credentials: { email: row.email, password: 'Tmp-Pass#1234' } });
    fireEvent.click(screen.getByLabelText(/free pilot/));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(provisionRegistration).toHaveBeenCalledWith(row.id, expect.objectContaining({ allowUnpaid: true, ownerEmail: row.email })));
  });

  it('a paid request is created with one call and the password is shown once', async () => {
    withRows({ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID', paidAmountPaise: 150_000 })] });
    listRegistrations.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ items: status === 'QUALIFIED' ? [{ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID' })] }] : [], total: 1, skip: 0, take: 100 }),
    );
    provisionRegistration.mockResolvedValue({ status: 'DONE', steps: steps(7), failedStep: null, error: null, businessId: 'b-1', ownerEmail: row.email, credentials: { email: row.email, password: 'Tmp-Pass#1234' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create restaurant account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Tmp-Pass#1234')).toBeTruthy();
    expect(provisionRegistration).toHaveBeenCalledTimes(1);
    expect(provisionRegistration.mock.calls[0]?.[1]).not.toHaveProperty('allowUnpaid');
    expect(screen.getByText(/shown only now and is not stored/)).toBeTruthy();
  });

  it('a failed step is shown with the server message, and Retry resumes (the owner email can be fixed)', async () => {
    withRows({ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID' })] });
    listRegistrations.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ items: status === 'QUALIFIED' ? [{ ...row, status: 'QUALIFIED', payments: [link({ status: 'PAID' })] }] : [], total: 1, skip: 0, take: 100 }),
    );
    provisionRegistration
      .mockResolvedValueOnce({ status: 'FAILED', steps: steps(2, 2), failedStep: 'owner', error: 'That email already has an account. Use a different owner email and retry.', businessId: 'b-1', ownerEmail: row.email })
      .mockResolvedValueOnce({ status: 'DONE', steps: steps(7), failedStep: null, error: null, businessId: 'b-1', ownerEmail: 'new@example.com', credentials: { email: 'new@example.com', password: 'Tmp-Pass#9999' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create restaurant account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/already has an account/)).toBeTruthy();
    expect(screen.getByText('Create the owner login')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Owner email.*change it/), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Tmp-Pass#9999')).toBeTruthy();
    expect(provisionRegistration).toHaveBeenLastCalledWith(row.id, { ownerEmail: 'new@example.com' });
  });
});
