import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import type { PaymentLink, RegistrationRequest } from './api';

const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

const make = (over: Partial<RegistrationRequest>): RegistrationRequest => ({
  id: '00000000-0000-4000-8000-000000000000',
  referenceCode: 'NX-AAAAAA',
  status: 'NEW',
  restaurantName: 'Cafe',
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
  businessId: null,
  payments: [],
  createdAt: at(1),
  updatedAt: at(1),
  ...over,
});

const payment = (over: Partial<PaymentLink>): PaymentLink => ({
  id: 'p-1',
  registrationId: 'x',
  linkId: 'L-1',
  linkUrl: 'https://payments-test.cashfree.com/links/abc',
  amountPaise: 1_149_320,
  currency: 'INR',
  purpose: 'Floor yearly',
  planKey: 'floor',
  billingCycle: 'yearly',
  status: 'PAID',
  paidAmountPaise: 1_149_320,
  expiresAt: null,
  paidAt: at(0),
  createdAt: at(0),
  ...over,
});

// Newest first on purpose: the page must reorder by urgency, not trust the order it was given.
const freshNew = make({ id: 'a1', referenceCode: 'NX-FRESH1', restaurantName: 'Fresh Cafe', createdAt: at(0.01), phone: '+919000000001', email: 'fresh@example.com' });
const oldNew = make({ id: 'a2', referenceCode: 'NX-OLDNEW', restaurantName: 'Old Waiting Cafe', createdAt: at(3), phone: '+919000000002', email: 'old@example.com' });
const wrongAmount = make({ id: 'a3', referenceCode: 'NX-WRONGA', restaurantName: 'Wrong Amount Cafe', createdAt: at(2), payments: [payment({ id: 'p-m', status: 'AMOUNT_MISMATCH', paidAmountPaise: 10_000 })], phone: '+919000000003', email: 'wrong@example.com' });
const paidNoAccount = make({ id: 'a4', referenceCode: 'NX-PAIDNA', restaurantName: 'Paid Cafe', status: 'QUALIFIED', createdAt: at(1), payments: [payment({ id: 'p-p' })], phone: '+919000000004', email: 'paid@example.com' });

const listRegistrations = vi.fn();
const getAttention = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  listRegistrations: (...a: unknown[]) => listRegistrations(...a),
  getAttention: (...a: unknown[]) => getAttention(...a),
}));

import { RegistrationsPage, priorityOf } from './RegistrationsPage';

function renderPage() {
  return render(
    <ToastProvider>
      <RegistrationsPage />
    </ToastProvider>,
  );
}

const names = () => Array.from(document.querySelectorAll('li[id^="reg-"] p.text-lg')).map((n) => n.textContent);

beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  listRegistrations.mockReset();
  getAttention.mockReset();
  getAttention.mockResolvedValue({ failedProvisioning: [], paidNotConverted: [], mismatch: [], paidClosed: [] });
  listRegistrations.mockImplementation(({ status, take }: { status: string; take?: number }) => {
    const byStatus: Record<string, RegistrationRequest[]> = { NEW: [freshNew, oldNew, wrongAmount], QUALIFIED: [paidNoAccount], CONTACTED: [], CONVERTED: [], REJECTED: [], SPAM: [] };
    const rows = byStatus[status] ?? [];
    return Promise.resolve({ items: take === 1 ? [] : rows, total: rows.length, skip: 0, take: take ?? 100 });
  });
  window.history.replaceState(null, '', '/registrations');
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('priorityOf', () => {
  it('ranks money waiting on an account first, then wrong amounts, then new requests, then the rest', () => {
    expect([paidNoAccount, wrongAmount, oldNew, make({ status: 'CONTACTED' })].map(priorityOf)).toEqual([0, 1, 2, 3]);
  });
});

describe('Registrations triage', () => {
  it('lists what needs a person first, then the longest waiting', async () => {
    renderPage();
    await screen.findByText('Paid Cafe');
    expect(names()).toEqual(['Paid Cafe', 'Wrong Amount Cafe', 'Old Waiting Cafe', 'Fresh Cafe']);
  });

  it('says how long each request has waited and what the money situation is', async () => {
    renderPage();
    await screen.findByText('Paid Cafe');
    expect(screen.getByText('3 days ago')).toBeTruthy();
    expect(screen.getByText('Paid. Create the restaurant account.')).toBeTruthy();
    expect(screen.getByText('A wrong amount was paid. Check it in Cashfree.')).toBeTruthy();
  });

  it('shows how many requests wait in each tab', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: 'Open · 4' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Spam · 0' })).toBeTruthy();
  });

  it('finds a request by name, phone digits, email or reference code, and says so when nothing matches', async () => {
    renderPage();
    await screen.findByText('Paid Cafe');
    const box = screen.getByRole('searchbox', { name: 'Search requests' });
    fireEvent.change(box, { target: { value: 'wrong' } });
    expect(names()).toEqual(['Wrong Amount Cafe']);
    fireEvent.change(box, { target: { value: '9000000002' } });
    expect(names()).toEqual(['Old Waiting Cafe']);
    fireEvent.change(box, { target: { value: 'NX-FRESH1' } });
    expect(names()).toEqual(['Fresh Cafe']);
    fireEvent.change(box, { target: { value: 'zzz-nothing' } });
    expect(await screen.findByText('No requests match')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' }).at(-1) as HTMLButtonElement);
    expect(names().length).toBe(4);
  });

  it('keeps the rarely used actions in one More actions menu that closes with Escape', async () => {
    renderPage();
    await screen.findByText('Fresh Cafe');
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    // The last card is an unpaid new request, the one that offers Record payment.
    const trigger = screen.getAllByRole('button', { name: 'More actions' }).at(-1) as HTMLButtonElement;
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('puts "Accept as paid" on the wrong-amount payment itself, next to Check payment', async () => {
    renderPage();
    const card = (await screen.findByText('Wrong Amount Cafe')).closest('li') as HTMLElement;
    expect(within(card).getByRole('button', { name: 'Accept as paid' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Check payment' })).toBeTruthy();
  });

  it('names the plan in words on a payment row (Floor yearly, not "floor yearly")', async () => {
    renderPage();
    const card = (await screen.findByText('Paid Cafe')).closest('li') as HTMLElement;
    expect(within(card).getByText(/Floor Yearly/)).toBeTruthy();
  });

  it('"View" in the attention strip scrolls to the request and rings it', async () => {
    getAttention.mockResolvedValue({
      failedProvisioning: [],
      paidNotConverted: [{ registrationId: 'a4', restaurantName: 'Paid Cafe', referenceCode: 'NX-PAIDNA' }],
      mismatch: [],
      paidClosed: [],
    });
    renderPage();
    const strip = await screen.findByRole('region', { name: 'Needs attention' });
    expect(within(strip).getByText('NX-PAIDNA')).toBeTruthy();
    fireEvent.click(within(strip).getByRole('button', { name: 'View' }));
    const card = document.getElementById('reg-a4') as HTMLElement;
    await waitFor(() => expect(card.className).toContain('ring-2'));
  });
});
