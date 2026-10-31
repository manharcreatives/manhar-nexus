import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ToastProvider } from '../../ui/Toast';
import { configApi } from '../../config/api';
import type { GuestSession } from '../api';
import { BillShowActions } from './BillShowActions';
import { BillShowDialog } from './BillShowDialog';
import { billShowApi, type BillView, type PaymentQrView } from './billShowApi';
import type { BillShowCaps } from './permissions';

vi.mock('./billShowApi', async (orig) => ({ ...(await orig<typeof import('./billShowApi')>()), billShowApi: { forSession: vi.fn(), paymentQr: vi.fn() } }));
vi.mock('../../config/api', () => ({ configApi: { setSetting: vi.fn() } }));
const roles = vi.hoisted(() => ({ current: ['service-team'] }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { realm: 'BUSINESS', roles: roles.current.map((key) => ({ key, name: key })) } }),
}));
vi.mock('../CheckoutDialog', () => ({
  CheckoutDialog: ({ initialMethod }: { initialMethod?: string }) => <div role="dialog" aria-label="checkout-mock">checkout on {initialMethod}</div>,
}));

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

const forSession = vi.mocked(billShowApi.forSession);
const paymentQr = vi.mocked(billShowApi.paymentQr);

const view = (over: Partial<NonNullable<BillView['bill']>> = {}, top: Partial<BillView> = {}): BillView => ({
  state: 'READY',
  business: { name: 'Saffron Table', legalName: 'Saffron Table LLP', address: '12 MG Road, Ahmedabad', gstin: '24ABCDE1234F1Z5', logoUrl: null, accentColor: null },
  location: { name: 'Main', code: 'ST' },
  tableCode: 'T4',
  bill: {
    invoiceId: 'inv-1',
    status: 'FINALISED',
    reference: 'ST-0307',
    currencyCode: 'INR',
    issuedAt: '2026-10-31T13:30:00.000Z',
    lines: [
      { id: 'l1', name: 'Paneer Tikka', variant: 'Half', modifiers: '+ Extra mint', quantity: 2, unitPriceMinorUnits: 24000, amountMinorUnits: 48000 },
      { id: 'l2', name: 'Masala Chai', variant: null, modifiers: null, quantity: 1, unitPriceMinorUnits: 6000, amountMinorUnits: 6000 },
    ],
    subtotalMinorUnits: 54000,
    taxLines: [
      {
        label: 'GST 5%',
        ratePercent: 5,
        taxableMinorUnits: 54000,
        taxMinorUnits: 2700,
        components: [
          { label: 'CGST', ratePercent: 2.5, taxMinorUnits: 1350 },
          { label: 'SGST', ratePercent: 2.5, taxMinorUnits: 1350 },
        ],
      },
    ],
    totalTaxMinorUnits: 2700,
    roundingMinorUnits: 0,
    grandTotalMinorUnits: 56700,
    paid: false,
    paidAt: null,
    paymentPending: false,
    ...over,
  },
  ...top,
});

const qr = (over: Partial<PaymentQrView> = {}): PaymentQrView => ({
  invoiceId: 'inv-1',
  status: 'FINALISED',
  reference: 'ST-0307',
  tableCode: 'T4',
  amountMinorUnits: 56700,
  currencyCode: 'INR',
  ready: true,
  reason: null,
  paid: false,
  paymentPending: false,
  upi: {
    uri: 'upi://pay?pa=saffron@okhdfcbank&pn=Saffron%20Table&am=567.00&cu=INR&tn=Bill%20ST-0307%20Table%20T4&tr=ST0307',
    vpa: 'saffron@okhdfcbank',
    payeeName: 'Saffron Table',
    note: 'Bill ST-0307 Table T4',
    transactionRef: 'ST0307',
  },
  ...over,
});

const caps = (over: Partial<BillShowCaps> = {}): BillShowCaps => ({ canShowBill: true, canShowPaymentQr: true, canRecordPayment: false, canConfigureUpi: false, ...over });

function mount(initialView: 'bill' | 'qr', c: BillShowCaps = caps(), onRecordPayment?: () => void) {
  return render(
    <MemoryRouter>
      <BillShowDialog sessionId="s-1" tableCode="T4" initialView={initialView} caps={c} onClose={vi.fn()} onRecordPayment={onRecordPayment} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  forSession.mockReset();
  paymentQr.mockReset();
  vi.mocked(configApi.setSetting).mockReset();
  roles.current = ['service-team'];
});
afterEach(cleanup);

describe('Show bill', () => {
  it('shows the restaurant, itemised lines, GST lines and a large total', async () => {
    forSession.mockResolvedValue(view());
    mount('bill');
    expect(await screen.findByText('Saffron Table')).toBeTruthy();
    expect(screen.getByText('12 MG Road', { exact: false })).toBeTruthy();
    expect(screen.getByText('GSTIN 24ABCDE1234F1Z5')).toBeTruthy();
    expect(screen.getByText('ST-0307')).toBeTruthy();
    expect(screen.getByText('Paneer Tikka')).toBeTruthy();
    expect(screen.getByText('Half')).toBeTruthy();
    expect(screen.getByText('+ Extra mint')).toBeTruthy();
    expect(screen.getByText('2 x ₹240.00')).toBeTruthy();
    expect(screen.getByText('Subtotal').nextElementSibling?.textContent).toBe('₹540.00');
    expect(screen.getByText('CGST 2.5%').nextElementSibling?.textContent).toBe('₹13.50');
    expect(screen.getByText('SGST 2.5%').nextElementSibling?.textContent).toBe('₹13.50');
    expect(screen.getByText('Total to pay')).toBeTruthy();
    expect(screen.getAllByText('₹567.00').length).toBeGreaterThan(0); // the big total (screen-reader text carries the exact amount)
  });

  it('prints a non-GST tax category with its rate and a rounding line when there is one', async () => {
    forSession.mockResolvedValue(
      view({ taxLines: [{ label: 'Service charge', ratePercent: 10, taxableMinorUnits: 54000, taxMinorUnits: 5400, components: [] }], roundingMinorUnits: -50 }),
    );
    mount('bill');
    expect(await screen.findByText('Service charge 10%')).toBeTruthy();
    expect(screen.getByText('Rounding').nextElementSibling?.textContent).toBe('-₹0.50');
  });

  it('has a paid state', async () => {
    forSession.mockResolvedValue(view({ paid: true, paidAt: '2026-10-31T13:40:00.000Z' }));
    mount('bill');
    expect(await screen.findByText('Total paid')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show payment QR' })).toBeNull(); // nothing left to pay
  });

  it('tells the waiter when there is no bill yet or it is not final, and never shows a draft', async () => {
    forSession.mockResolvedValue({ ...view(), state: 'NO_BILL', bill: null });
    mount('bill');
    expect(await screen.findByText('No bill yet')).toBeTruthy();
    cleanup();
    forSession.mockResolvedValue({ ...view(), state: 'NOT_FINALISED', bill: null });
    mount('bill');
    expect(await screen.findByText('The bill is not ready yet')).toBeTruthy();
    expect(screen.queryByText('Paneer Tikka')).toBeNull();
  });

  it('has loading and error states, and the error retries', async () => {
    forSession.mockRejectedValueOnce({ status: 500 }).mockResolvedValueOnce(view());
    mount('bill');
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(await screen.findByText('Could not load the bill')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Paneer Tikka')).toBeTruthy();
  });

  it('hides the QR button when the role cannot show it', async () => {
    forSession.mockResolvedValue(view());
    mount('bill', caps({ canShowPaymentQr: false }));
    await screen.findByText('Paneer Tikka');
    expect(screen.queryByRole('button', { name: 'Show payment QR' })).toBeNull();
  });
});

describe('Show payment QR', () => {
  it('shows a big scannable QR, the exact amount, payee, UPI ID, reference, a deep link, and waits for payment', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr());
    mount('bill');
    fireEvent.click(await screen.findByRole('button', { name: 'Show payment QR' }));
    const code = await screen.findByRole('img', { name: 'UPI payment QR code for ₹567.00' });
    expect(code.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100); // real module matrix
    expect(paymentQr).toHaveBeenCalledWith('inv-1');
    expect(screen.getAllByText('₹567.00').length).toBeGreaterThan(0);
    expect(screen.getByText('saffron@okhdfcbank')).toBeTruthy();
    expect(screen.getByText('ST-0307')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Pay with a UPI app/ });
    expect(link.getAttribute('href')).toContain('upi://pay?pa=saffron@okhdfcbank');
    expect(link.getAttribute('href')).toContain('am=567.00');
    expect(screen.getByText('Waiting for payment')).toBeTruthy();
  });

  it('opens directly on the QR when asked, and goes back to the bill', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr());
    mount('qr');
    await screen.findByRole('img', { name: /UPI payment QR code/ });
    fireEvent.click(screen.getByRole('button', { name: 'Show bill' }));
    expect(await screen.findByText('Paneer Tikka')).toBeTruthy();
  });

  it('says a UPI payment is being confirmed when one has started', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr({ paymentPending: true }));
    mount('qr');
    expect(await screen.findByText(/Waiting for the cashier to confirm/)).toBeTruthy();
  });

  it('turns into "Payment received" when the bill is paid, with no QR left on screen', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr({ paid: true, ready: false, reason: 'PAID', upi: null }));
    mount('qr');
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /UPI payment QR/ })).toBeNull();
  });

  it('explains when UPI is not set up; owners can set the UPI ID right there and the QR then appears', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValueOnce(qr({ ready: false, reason: 'UPI_NOT_CONFIGURED', upi: null })).mockResolvedValueOnce(qr());
    vi.mocked(configApi.setSetting).mockResolvedValue({} as never);
    mount('qr', caps({ canConfigureUpi: true }));
    expect(await screen.findByText(/UPI ID is not set up yet/)).toBeTruthy();
    const input = screen.getByLabelText('Restaurant UPI ID');
    fireEvent.change(input, { target: { value: 'not a vpa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save UPI ID' }));
    expect(await screen.findByText('Enter a valid UPI ID such as name@bank.')).toBeTruthy();
    expect(configApi.setSetting).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'saffron@okhdfcbank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save UPI ID' }));
    await waitFor(() => expect(configApi.setSetting).toHaveBeenCalledWith('checkout', 'upi_vpa', 'saffron@okhdfcbank'));
    expect(await screen.findByRole('img', { name: /UPI payment QR code/ })).toBeTruthy();
  });

  it('tells a waiter to ask the owner instead of offering the setting', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr({ ready: false, reason: 'UPI_NOT_CONFIGURED', upi: null }));
    mount('qr');
    expect(await screen.findByText(/Ask the owner or a manager/)).toBeTruthy();
    expect(screen.queryByLabelText('Restaurant UPI ID')).toBeNull();
  });

  it('"Mark as collected" goes through the existing checkout flow, and only for roles that may record payments', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr());
    const record = vi.fn();
    mount('qr', caps({ canRecordPayment: true }), record);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as collected' }));
    expect(record).toHaveBeenCalledTimes(1);
    cleanup();
    mount('qr', caps({ canRecordPayment: false }), record);
    await screen.findByRole('img', { name: /UPI payment QR code/ });
    expect(screen.queryByRole('button', { name: 'Mark as collected' })).toBeNull();
    expect(screen.getByText(/The cashier confirms the payment/)).toBeTruthy();
  });

  it('shows an error with retry when the QR cannot be loaded', async () => {
    forSession.mockResolvedValue(view());
    paymentQr.mockRejectedValueOnce({ status: 403 }).mockResolvedValueOnce(qr());
    mount('qr');
    expect(await screen.findByText('Could not load the payment QR')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: /UPI payment QR code/ })).toBeTruthy();
  });
});

describe('BillShowActions (permission gating on the table panel)', () => {
  const session = { id: 's-1' } as GuestSession;
  const renderActions = () =>
    render(
      <MemoryRouter>
        <ToastProvider>
          <BillShowActions session={session} tableCode="T4" />
        </ToastProvider>
      </MemoryRouter>,
    );

  it('waiters get both buttons', () => {
    roles.current = ['service-team'];
    renderActions();
    expect(screen.getByRole('button', { name: 'Show bill' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show payment QR' })).toBeTruthy();
  });

  it('hosts and kitchen staff get neither', () => {
    roles.current = ['host'];
    const { container } = renderActions();
    expect(container.textContent).toBe('');
  });

  it('a cashier\'s "Mark as collected" opens the existing checkout on UPI', async () => {
    roles.current = ['checkout-associate'];
    forSession.mockResolvedValue(view());
    paymentQr.mockResolvedValue(qr());
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Show payment QR' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as collected' }));
    await act(async () => {});
    expect(await screen.findByRole('dialog', { name: 'checkout-mock' })).toBeTruthy();
    expect(screen.getByText('checkout on UPI')).toBeTruthy();
  });
});
