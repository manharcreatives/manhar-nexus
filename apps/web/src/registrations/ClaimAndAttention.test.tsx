import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { PlanInfo, registrationHref } from '../commercial/PlanInfo';
import { ToastProvider } from '../ui/Toast';
import type { RegistrationRequest } from './api';

const TOKEN = 'tok_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const row: RegistrationRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  referenceCode: 'NX-7K2Q9M',
  status: 'CONVERTED',
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+919714571522',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: 1,
  planKey: 'floor',
  billingCycle: 'yearly',
  message: null,
  assignedTo: null,
  internalNotes: null,
  businessId: 'b-1',
  autoProvisioned: true,
  payments: [],
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

const listRegistrations = vi.fn();
const issueClaimLink = vi.fn();
const getAttention = vi.fn();
const provisionRegistration = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listRegistrations: (...a: unknown[]) => listRegistrations(...a),
  issueClaimLink: (...a: unknown[]) => issueClaimLink(...a),
  getAttention: (...a: unknown[]) => getAttention(...a),
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

function withRows(status: string, ...rows: RegistrationRequest[]) {
  listRegistrations.mockImplementation(({ status: s }: { status: string }) => Promise.resolve({ items: s === status ? rows : [], total: rows.length, skip: 0, take: 100 }));
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
  listRegistrations.mockReset();
  issueClaimLink.mockReset();
  getAttention.mockReset();
  provisionRegistration.mockReset();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [] });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  window.history.replaceState(null, '', '/registrations#reg-x');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Registrations: set-password link for an account that exists', () => {
  it('notes that the account was created automatically', async () => {
    withRows('CONVERTED', row);
    renderPage();
    expect(await screen.findByText('Account created automatically after payment.')).toBeTruthy();
  });

  it('does not offer the link before the account exists', async () => {
    window.history.replaceState(null, '', '/registrations');
    withRows('NEW', { ...row, status: 'NEW', businessId: null, autoProvisioned: false });
    renderPage();
    await screen.findByText('Ananda Cafe');
    expect(screen.queryByRole('button', { name: 'Copy set-password link' })).toBeNull();
  });

  it('copies the link (token in the fragment) and reuses it for WhatsApp instead of cancelling it with a new one', async () => {
    withRows('CONVERTED', row);
    issueClaimLink.mockResolvedValue({ token: TOKEN, expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString() });
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy set-password link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/set-password#t=${TOKEN}`));
    expect(issueClaimLink).toHaveBeenCalledWith(row.id);

    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp the set-password link' }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(issueClaimLink).toHaveBeenCalledTimes(1);
    const [href] = open.mock.calls[0] as [string];
    expect(href).toContain('https://wa.me/919714571522?text=');
    const text = decodeURIComponent(href.split('text=')[1] ?? '');
    expect(text).toBe(`Hello Asha Patel, your Manhar Nexus account for Ananda Cafe is ready. Set your password here: ${window.location.origin}/set-password#t=${TOKEN} (valid 72 hours)`);
  });

  it('warns that a new link cancels the one the owner may have open, and mentions AutoPay-paid requests', async () => {
    withRows('CONVERTED', { ...row, payments: [{ ...row.payments[0], id: 'p-a', status: 'PAID', source: 'AUTOPAY' } as never] });
    renderPage();
    const note = await screen.findByText(/cancels the old one, including a link the owner already has open/);
    expect(note.textContent).toContain('Paid by AutoPay?');
  });

  it('says so when a link could not be made, and copies nothing', async () => {
    withRows('CONVERTED', row);
    issueClaimLink.mockRejectedValue(new Error('boom'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy set-password link' }));
    expect((await screen.findAllByText('Could not make a link. Please try again.')).length).toBeGreaterThan(0);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('Registrations: needs attention', () => {
  it('shows nothing when there is nothing to do', async () => {
    withRows('CONVERTED', row);
    renderPage();
    await screen.findByText('Ananda Cafe');
    expect(screen.queryByText('Needs attention')).toBeNull();
  });

  it('lists a failed account job with its safe reason, and Retry opens the account dialog (never a blind retry)', async () => {
    window.history.replaceState(null, '', '/registrations');
    withRows('NEW', { ...row, status: 'NEW', businessId: null, autoProvisioned: false });
    getAttention.mockResolvedValue({
      failedProvisioning: [{ registrationId: row.id, restaurantName: 'Ananda Cafe', lastError: 'That owner email already has an account.', currentStep: 'owner' }],
      paidNotConverted: [],
    });
    renderPage();
    expect(await screen.findByText('The account for Ananda Cafe could not be created.')).toBeTruthy();
    expect(screen.getByText('That owner email already has an account.')).toBeTruthy();
    expect(screen.getByText('Stopped at: owner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByDisplayValue('asha@example.com')).toBeTruthy();
    expect(provisionRegistration).not.toHaveBeenCalled();
  });
  it('a paid request with no account offers Create account, which opens the account dialog', async () => {
    window.history.replaceState(null, '', '/registrations');
    const paid = { ...row, status: 'QUALIFIED' as const, businessId: null, autoProvisioned: false, payments: [] };
    withRows('QUALIFIED', paid);
    getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [{ registrationId: row.id, restaurantName: 'Ananda Cafe' }] });
    renderPage();
    expect(await screen.findByText('Ananda Cafe has paid but has no account yet.')).toBeTruthy();
    const strip = screen.getByRole('region', { name: 'Needs attention' });
    fireEvent.click(within(strip).getByRole('button', { name: 'Create account' }));
    expect(await screen.findByDisplayValue('Ananda Cafe')).toBeTruthy();
  });

  it('money on a spam or rejected request is shown for a human decision, with no Create account button', async () => {
    window.history.replaceState(null, '', '/registrations');
    withRows('NEW');
    getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [], paidClosed: [{ registrationId: row.id, restaurantName: 'Ananda Cafe' }] });
    renderPage();
    expect(await screen.findByText(/Ananda Cafe paid, but the request is marked spam or rejected/)).toBeTruthy();
    const strip = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(strip).queryByRole('button', { name: /Create|Accept|Retry/ })).toBeNull();
  });

  it('a long attention list shows five rows and a "Show N more" button', async () => {
    window.history.replaceState(null, '', '/registrations');
    withRows('NEW');
    const many = Array.from({ length: 8 }, (_, i) => ({ registrationId: `r${i}`, restaurantName: `Cafe ${i}` }));
    getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [], paidClosed: many });
    renderPage();
    expect(await screen.findByText(/Cafe 0 paid, but/)).toBeTruthy();
    expect(screen.queryByText(/Cafe 7 paid, but/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 more' }));
    expect(await screen.findByText(/Cafe 7 paid, but/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeTruthy();
  });

  it('a failed attention check does not break the page', async () => {
    getAttention.mockRejectedValue(new Error('down'));
    withRows('CONVERTED', row);
    renderPage();
    expect(await screen.findByText('Ananda Cafe')).toBeTruthy();
  });
});

describe('Clients: plan, paid-until and how they pay', () => {
  const now = Date.parse('2026-11-06T10:00:00Z');
  it('shows the plan chip with its cycle, the paid-until date and the source, with a link to the registration', () => {
    render(<PlanInfo now={now} client={{ planKey: 'floor', billingCycle: 'yearly', paidUntil: '2027-11-06T00:00:00Z', billingSource: 'AUTOPAY', registrationId: 'abc' }} />);
    expect(screen.getByText('Floor · yearly')).toBeTruthy();
    expect(screen.getByText('AutoPay')).toBeTruthy();
    expect(screen.getByText(/^Paid until /)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View registration' }).getAttribute('href')).toBe(registrationHref('abc'));
  });

  it('marks an overdue client in red', () => {
    render(<PlanInfo now={now} client={{ planKey: 'counter', billingCycle: 'monthly', paidUntil: '2026-10-01T00:00:00Z', billingSource: 'LINK' }} />);
    const line = screen.getByText(/^Overdue since /);
    expect(line.className).toContain('text-bad');
    expect(screen.getByText('Payment link')).toBeTruthy();
  });

  it('a client with no plan yet says so, and the compact form leaves out the link', () => {
    const { rerender } = render(<PlanInfo client={{}} />);
    expect(screen.getByText('No plan yet')).toBeTruthy();
    rerender(<PlanInfo compact now={now} client={{ planKey: 'pass', billingCycle: 'yearly', paidUntil: null, billingSource: 'MANUAL', registrationId: 'abc' }} />);
    expect(screen.getByText('Not paid yet')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
