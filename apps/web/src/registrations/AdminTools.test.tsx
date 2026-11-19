import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { PeopleBlock } from '../commercial/PeopleBlock';
import { ToastProvider } from '../ui/Toast';
import { duplicateCount, planName, splitOfferCode, type PaymentLink, type RegistrationRequest } from './api';

const base: RegistrationRequest = {
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
  planKey: 'floor',
  billingCycle: 'yearly',
  message: 'Please call after 5pm [Code: FOUNDING26]',
  assignedTo: null,
  internalNotes: null,
  businessId: null,
  payments: [],
  createdAt: '2026-12-01T10:00:00.000Z',
  updatedAt: '2026-12-01T10:00:00.000Z',
};

const mismatch: PaymentLink = {
  id: 'p-1',
  registrationId: base.id,
  linkId: 'NX-7K2Q9M-ab12cd34',
  linkUrl: 'https://payments-test.cashfree.com/links/abc',
  amountPaise: 1_149_320,
  currency: 'INR',
  purpose: 'Floor yearly',
  status: 'AMOUNT_MISMATCH',
  paidAmountPaise: 10_000,
  expiresAt: null,
  paidAt: null,
  createdAt: '2026-12-02T10:00:00.000Z',
};

const listRegistrations = vi.fn();
const updateRegistration = vi.fn();
const getAttention = vi.fn();
const recordManualPayment = vi.fn();
const acceptMismatchedPayment = vi.fn();
const provisionRegistration = vi.fn();
const issueClaimLink = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listRegistrations: (...a: unknown[]) => listRegistrations(...a),
  updateRegistration: (...a: unknown[]) => updateRegistration(...a),
  getAttention: (...a: unknown[]) => getAttention(...a),
  recordManualPayment: (...a: unknown[]) => recordManualPayment(...a),
  acceptMismatchedPayment: (...a: unknown[]) => acceptMismatchedPayment(...a),
  provisionRegistration: (...a: unknown[]) => provisionRegistration(...a),
  issueClaimLink: (...a: unknown[]) => issueClaimLink(...a),
}));

const listClientUsers = vi.fn();
const createResetLink = vi.fn();
vi.mock('../commercial/api', async (orig) => ({
  ...(await orig<typeof import('../commercial/api')>()),
  listClientUsers: (...a: unknown[]) => listClientUsers(...a),
  createResetLink: (...a: unknown[]) => createResetLink(...a),
}));

import { RegistrationsPage } from './RegistrationsPage';

function renderPage() {
  return render(
    <ToastProvider>
      <RegistrationsPage />
    </ToastProvider>,
  );
}

/** The rarely used actions live under one More actions button: open it, then choose one. */
async function chooseMore(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
  fireEvent.click(await screen.findByRole('button', { name }));
}

function withRows(...rows: RegistrationRequest[]) {
  listRegistrations.mockImplementation(({ status }: { status: string }) =>
    Promise.resolve({ items: status === 'NEW' ? rows : [], total: rows.length, skip: 0, take: 100 }),
  );
}

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

const writeText = vi.fn();
beforeEach(() => {
  for (const f of [listRegistrations, updateRegistration, getAttention, recordManualPayment, acceptMismatchedPayment, provisionRegistration, issueClaimLink, listClientUsers, createResetLink, writeText]) f.mockReset();
  getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [], mismatch: [] });
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  window.history.replaceState(null, '', '/registrations');
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('pure helpers', () => {
  it('names plans, and calls "not sure" unnamed', () => {
    expect(planName('floor')).toBe('Floor');
    expect(planName('not-sure')).toBeNull();
  });

  it('splits the offer-code tag off the visitor message', () => {
    expect(splitOfferCode('Call me [Code: FOUNDING26]')).toEqual({ text: 'Call me', code: 'FOUNDING26' });
    expect(splitOfferCode('[Code: FOUNDING26]')).toEqual({ text: null, code: 'FOUNDING26' });
    expect(splitOfferCode('plain')).toEqual({ text: 'plain', code: null });
    expect(splitOfferCode(null)).toEqual({ text: null, code: null });
  });

  it('counts other requests with the same email or phone (any +91 format)', () => {
    const others = [
      { id: 'a', email: 'ASHA@example.com', phone: '+910000000000' },
      { id: 'b', email: 'x@y.co', phone: '9714571522' },
      { id: 'c', email: 'z@y.co', phone: '+911111111111' },
    ];
    expect(duplicateCount({ id: 'me', email: 'asha@example.com', phone: '+919714571522' }, [...others, { id: 'me', email: 'asha@example.com', phone: '+919714571522' }])).toBe(2);
  });
});

describe('request card', () => {
  it('shows the plan chip from the first moment, the offer code as a chip, and the message without the tag', async () => {
    withRows(base);
    renderPage();
    expect(await screen.findByText('Floor · Yearly')).toBeTruthy();
    expect(screen.getByText('Please call after 5pm')).toBeTruthy();
    expect(screen.getByText('Offer code: FOUNDING26')).toBeTruthy();
  });

  it('says "Plan not chosen" instead of the raw not-sure key', async () => {
    withRows({ ...base, planKey: 'not-sure' });
    renderPage();
    expect(await screen.findByText('Plan not chosen')).toBeTruthy();
    expect(screen.queryByText(/not-sure/)).toBeNull();
  });

  it('warns when another request has the same email', async () => {
    withRows(base, { ...base, id: '22222222-2222-4222-8222-222222222222', referenceCode: 'NX-AAAAAA' });
    renderPage();
    expect((await screen.findAllByText(/Same email or phone as 1 other request/)).length).toBe(2);
  });

  it('Reject and Spam ask first, then move, and offer Undo', async () => {
    withRows(base);
    updateRegistration.mockResolvedValue({ ...base, status: 'REJECTED' });
    renderPage();
    await chooseMore('Reject');
    expect(updateRegistration).not.toHaveBeenCalled();
    expect(await screen.findByText('Reject Ananda Cafe?')).toBeTruthy();
    const confirm = screen.getAllByRole('button', { name: 'Reject' }).at(-1) as HTMLButtonElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(updateRegistration).toHaveBeenCalledWith(base.id, { status: 'REJECTED' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(updateRegistration).toHaveBeenCalledWith(base.id, { status: 'NEW' }));
  });
});

describe('edit contact details', () => {
  it('sends only what changed', async () => {
    withRows(base);
    updateRegistration.mockResolvedValue({ ...base, phone: '+919714571599' });
    renderPage();
    await chooseMore('Edit details');
    fireEvent.change(await screen.findByDisplayValue('+919714571522'), { target: { value: '+919714571599' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateRegistration).toHaveBeenCalledWith(base.id, { phone: '+919714571599' }));
  });

  it('rejects a bad email or short phone without calling the API', async () => {
    withRows(base);
    renderPage();
    await chooseMore('Edit details');
    fireEvent.change(await screen.findByDisplayValue('asha@example.com'), { target: { value: 'nope' } });
    fireEvent.change(screen.getByDisplayValue('+919714571522'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a 10-digit mobile number.')).toBeTruthy();
    expect(updateRegistration).not.toHaveBeenCalled();
  });

  it('is not offered once the account exists', async () => {
    window.history.replaceState(null, '', '/registrations#reg-x');
    listRegistrations.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ items: status === 'CONVERTED' ? [{ ...base, status: 'CONVERTED', businessId: 'b-1' }] : [], total: 1, skip: 0, take: 100 }),
    );
    renderPage();
    await screen.findByText('Ananda Cafe');
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
  });
});

describe('record a manual payment', () => {
  it('needs a reference, then sends the plan, method and reference (the server prices it)', async () => {
    withRows(base);
    recordManualPayment.mockResolvedValue({ ...mismatch, status: 'PAID' });
    renderPage();
    await chooseMore('Record payment');
    expect(await screen.findByText('₹11,493.20')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText(/Add the reference/)).toBeTruthy();
    expect(recordManualPayment).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Reference/), { target: { value: 'UTR123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    // Money is read back once first: who, how much, how, and what happens next. Nothing is sent yet.
    expect(await screen.findByText(/creates the restaurant account for asha@example.com/)).toBeTruthy();
    expect(recordManualPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, record this payment' }));
    await waitFor(() => expect(recordManualPayment).toHaveBeenCalledTimes(1));
    const body = recordManualPayment.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).toMatchObject({ planKey: 'floor', cycle: 'yearly', method: 'UPI', reference: 'UTR123456', launchPack: false });
    expect(body).not.toHaveProperty('amountRupees');
  });

  it('a different amount needs a reason', async () => {
    withRows(base);
    renderPage();
    await chooseMore('Record payment');
    fireEvent.change(await screen.findByLabelText(/^Reference/), { target: { value: 'UTR123456' } });
    fireEvent.click(screen.getByLabelText(/amount received is different/));
    fireEvent.change(await screen.findByLabelText(/Amount \(₹\)/), { target: { value: '9000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText(/Write a short reason/)).toBeTruthy();
    expect(recordManualPayment).not.toHaveBeenCalled();
  });
});

describe('needs attention', () => {
  it('shows a mismatch as its own row with Accept as paid and no Create button, and accepting needs a reason', async () => {
    withRows({ ...base, payments: [mismatch] });
    getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [], mismatch: [{ registrationId: base.id, restaurantName: 'Ananda Cafe' }] });
    acceptMismatchedPayment.mockResolvedValue({ ...mismatch, status: 'PAID' });
    renderPage();
    const strip = await screen.findByRole('region', { name: 'Needs attention' });
    expect(strip.textContent).toContain('paid a different amount than the link');
    expect(strip.textContent).not.toContain('Create account');
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept as paid' })[0] as HTMLButtonElement);
    expect(await screen.findByText(/They paid ₹100 but the link was for ₹11,493.20/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept as paid' }).at(-1) as HTMLButtonElement);
    expect(await screen.findByText(/Write a short reason/)).toBeTruthy();
    expect(acceptMismatchedPayment).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Why are you accepting it/), { target: { value: 'agreed a discount' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept as paid' }).at(-1) as HTMLButtonElement);
    await waitFor(() => expect(acceptMismatchedPayment).toHaveBeenCalledWith(base.id, 'p-1', 'agreed a discount'));
  });

  it('re-checks after a dialog closes, including with Escape', async () => {
    withRows(base);
    renderPage();
    await screen.findByText('Ananda Cafe');
    const before = getAttention.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Create restaurant account' }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    fireEvent(dialog, new Event('close')); // what the browser sends on Esc
    await waitFor(() => expect(getAttention.mock.calls.length).toBeGreaterThan(before));
  });
});

describe('create account: the one-time password', () => {
  it('warns before closing without copying it, and offers a set-password link instead', async () => {
    withRows({ ...base, payments: [{ ...mismatch, status: 'PAID' }] });
    provisionRegistration.mockResolvedValue({
      status: 'DONE',
      steps: [],
      failedStep: null,
      error: null,
      businessId: 'b-1',
      ownerEmail: 'asha@example.com',
      credentials: { email: 'asha@example.com', password: 'Temp-Pass-123' },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create restaurant account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Temp-Pass-123')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy set-password link' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The password will not be shown again');
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Temp-Pass-123')).toBeTruthy();
  });
});

describe('Clients: people', () => {
  const owner = { id: 'u-1', email: 'asha@example.com', name: 'Asha Patel', status: 'ACTIVE', lastLoginAt: '2026-11-07T09:53:00.000Z', roles: ['Owner'], failedLoginCount: 2, lockedUntil: null };

  it('lists who can sign in, with last sign-in in Indian date order', async () => {
    listClientUsers.mockResolvedValue([owner, { ...owner, id: 'u-2', name: 'Raj', email: 'raj@example.com', lastLoginAt: null, failedLoginCount: 0 }]);
    render(
      <ToastProvider>
        <PeopleBlock businessId="b-1" />
      </ToastProvider>,
    );
    expect(await screen.findByText('asha@example.com')).toBeTruthy();
    expect(screen.getByText(/Last sign-in: 7 Nov 2026/)).toBeTruthy();
    expect(screen.getByText(/2 failed sign-ins/)).toBeTruthy();
    expect(screen.getByText('Never signed in')).toBeTruthy();
  });

  it('asks before making a reset link, then offers Copy and never shows the token', async () => {
    listClientUsers.mockResolvedValue([owner]);
    createResetLink.mockResolvedValue({ token: 'tok_SECRET_TOKEN_1234567890', expiresAt: '2026-11-10T00:00:00.000Z' });
    const { container } = render(
      <ToastProvider>
        <PeopleBlock businessId="b-1" ownerPhone="+919714571522" />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Reset password link' }));
    expect(createResetLink).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Make link' }));
    await waitFor(() => expect(createResetLink).toHaveBeenCalledWith('b-1', 'u-1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/set-password#t=tok_SECRET_TOKEN_1234567890')));
    expect(document.body.textContent).not.toContain('tok_SECRET_TOKEN_1234567890');
    expect(container.textContent).not.toContain('tok_SECRET_TOKEN_1234567890');
    const wa = screen.getByRole('link', { name: 'WhatsApp the link' });
    expect(wa.getAttribute('href')).toContain('https://wa.me/919714571522?text=');
  });
});
