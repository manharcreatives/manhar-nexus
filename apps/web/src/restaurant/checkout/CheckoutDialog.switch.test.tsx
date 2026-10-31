import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ToastProvider } from '../../ui/Toast';
import { CheckoutDialog } from '../CheckoutDialog';
import { checkoutApi, type GuestSession, type Invoice } from '../api';
import { paymentApi, type PaymentRecord } from './paymentApi';

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  checkoutApi: { getOrCreateInvoice: vi.fn(), finalise: vi.fn(), pay: vi.fn(), capture: vi.fn() },
}));
vi.mock('./paymentApi', () => ({ paymentApi: { list: vi.fn(), cancel: vi.fn() } }));

// jsdom has no modal <dialog>; emulate what <Dialog> relies on.
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

const pay = vi.mocked(checkoutApi.pay);
const capture = vi.mocked(checkoutApi.capture);
const list = vi.mocked(paymentApi.list);
const cancel = vi.mocked(paymentApi.cancel);

const TOTAL = 52500;
const invoice: Invoice = {
  id: 'inv-1',
  sessionId: 's-1',
  status: 'FINALISED',
  subtotalMinorUnits: 50000,
  totalTaxMinorUnits: 2500,
  grandTotalMinorUnits: TOTAL,
  lines: [],
};
const session = { id: 's-1' } as GuestSession;
const rec = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({ id: 'pay-1', invoiceId: 'inv-1', method: 'UPI', status: 'PENDING', amountMinorUnits: TOTAL, ...over });
const sent = (status: 'PENDING' | 'CAPTURED', id = 'pay-1', method = 'UPI') => ({ id, invoiceId: 'inv-1', method, amountMinorUnits: TOTAL, status });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function open(initialMethod?: 'CASH' | 'UPI') {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <ToastProvider>
      <CheckoutDialog session={session} tableCode="T4" onDone={onDone} onCancel={onCancel} initialMethod={initialMethod} />
    </ToastProvider>,
  );
  await screen.findByText('Payment method');
  return { onDone, onCancel };
}
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const method = (name: 'Cash' | 'UPI') => screen.getByRole('button', { name });
/** Disabled itself or by a disabled <fieldset> ancestor (the method group locks that way). */
const off = (el: HTMLElement) => el.matches(':disabled') || el.closest('fieldset[disabled]') !== null;

beforeEach(() => {
  vi.mocked(checkoutApi.getOrCreateInvoice).mockReset().mockResolvedValue(invoice);
  vi.mocked(checkoutApi.finalise).mockReset().mockResolvedValue(invoice);
  pay.mockReset();
  capture.mockReset();
  list.mockReset().mockResolvedValue([]);
  cancel.mockReset();
});
afterEach(cleanup);

describe('CheckoutDialog: no double payment', () => {
  it('sends ONE payment for a double click and disables every control while it is in flight', async () => {
    const d = deferred<ReturnType<typeof sent>>();
    pay.mockReturnValue(d.promise as never);
    await open();
    const collect = btn(/Collect/);
    fireEvent.click(collect);
    fireEvent.click(collect);
    fireEvent.click(collect);
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    expect(off(method('UPI'))).toBe(true); // change-method is locked in flight
    expect(off(method('Cash'))).toBe(true);
    expect(off(btn('Cancel'))).toBe(true);
    expect(off(screen.getByRole('button', { name: /Processing/ }))).toBe(true);
    await act(async () => d.resolve(sent('CAPTURED', 'pay-1', 'CASH')));
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('retries a lost response with the SAME idempotency key, after checking what the server holds', async () => {
    pay.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(sent('CAPTURED', 'pay-1', 'CASH') as never);
    await open();
    fireEvent.click(btn(/Collect/));
    expect(await screen.findByText('Not sure the last attempt was recorded')).toBeTruthy();
    const listCallsBefore = list.mock.calls.length;
    fireEvent.click(btn(/Collect/));
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(pay).toHaveBeenCalledTimes(2);
    expect(pay.mock.calls[1][3]).toBe(pay.mock.calls[0][3]); // same key: the API replays, never double-charges
    expect(list.mock.calls.length).toBeGreaterThan(listCallsBefore); // looked before writing again
  });

  it('does not pay again when the lost attempt turns out to have been recorded', async () => {
    pay.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await open();
    fireEvent.click(btn(/Collect/));
    await screen.findByText('Not sure the last attempt was recorded');
    list.mockResolvedValue([rec({ method: 'CASH', status: 'CAPTURED', changeMinorUnits: 0 })]);
    fireEvent.click(btn('Check payment status'));
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(screen.getByText(/already paid \(Cash\)/)).toBeTruthy();
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('a 409 "payment already active" shows the recorded UPI request instead of failing or duplicating', async () => {
    pay.mockRejectedValueOnce({ status: 409, message: 'Invoice already has an active or captured payment' });
    await open();
    fireEvent.click(method('UPI'));
    list.mockResolvedValue([rec()]);
    fireEvent.click(btn('Start UPI payment'));
    expect(await screen.findByText('Waiting for the UPI transfer')).toBeTruthy();
    expect(screen.getByText(/already recorded for this bill/)).toBeTruthy();
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('resumes a payment that already exists when the dialog is opened, and never creates another', async () => {
    list.mockResolvedValue([rec()]);
    await open();
    expect(await screen.findByText('Waiting for the UPI transfer')).toBeTruthy();
    expect(screen.getByText(/already started for this bill/)).toBeTruthy();
    expect(pay).not.toHaveBeenCalled();
    capture.mockResolvedValue(sent('CAPTURED') as never);
    fireEvent.change(screen.getByLabelText('UTR / reference number'), { target: { value: 'UTR9' } });
    fireEvent.click(btn('Confirm payment'));
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(capture).toHaveBeenCalledWith('pay-1', 'UTR9');
    expect(pay).not.toHaveBeenCalled();
  });

  it('opens straight on a bill that is already paid on the server', async () => {
    list.mockResolvedValue([rec({ method: 'CASH', status: 'CAPTURED' })]);
    render(
      <ToastProvider>
        <CheckoutDialog session={session} tableCode="T4" onDone={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(pay).not.toHaveBeenCalled();
  });
});

describe('CheckoutDialog: change payment method', () => {
  it('keeps typed cash and UTR when switching between methods before anything is recorded', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '600' } });
    fireEvent.click(method('UPI'));
    expect(screen.queryByLabelText('Cash received')).toBeNull();
    fireEvent.click(method('Cash'));
    expect((screen.getByLabelText('Cash received') as HTMLInputElement).value).toBe('600');
    expect(pay).not.toHaveBeenCalled();
  });

  it('cancels a pending UPI request only after confirmation, keeps the typed UTR, and uses a fresh key afterwards', async () => {
    pay.mockResolvedValueOnce(sent('PENDING') as never);
    await open();
    fireEvent.click(method('UPI'));
    fireEvent.click(btn('Start UPI payment'));
    await screen.findByText('Waiting for the UPI transfer');
    const firstUpiKey = pay.mock.calls[0][3];
    fireEvent.change(screen.getByLabelText('UTR / reference number'), { target: { value: 'UTR123' } });

    // The method buttons are locked while a request is recorded: the explicit, confirmed flow is the only way out.
    expect(off(method('Cash'))).toBe(true);
    fireEvent.click(btn('Change payment method'));
    const group = screen.getByRole('group', { name: 'Change the payment method?' });
    expect(within(group).getByText(/Only continue if the guest has not already paid/)).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();

    const d = deferred<PaymentRecord>();
    cancel.mockReturnValue(d.promise);
    fireEvent.click(within(group).getByRole('button', { name: 'Yes, change method' }));
    fireEvent.click(within(group).getByRole('button', { name: /Cancelling/ }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(cancel).toHaveBeenCalledWith('pay-1');
    expect(off(method('Cash'))).toBe(true); // locked while the cancel is in flight
    await act(async () => d.resolve(rec({ status: 'CANCELLED' })));

    expect(await screen.findByText(/UPI request cancelled/)).toBeTruthy();
    expect(screen.getByLabelText('Cash received')).toBeTruthy(); // back on method choice, cash selected
    expect(off(method('UPI'))).toBe(false);

    // Returning to UPI starts a NEW request (new key, not a replay of the cancelled one) and the typed UTR is still there.
    fireEvent.click(method('UPI'));
    expect(screen.getByText(/UTR123/)).toBeTruthy();
    pay.mockResolvedValueOnce(sent('PENDING', 'pay-2') as never);
    fireEvent.click(btn('Start UPI payment'));
    await screen.findByText('Waiting for the UPI transfer');
    expect(pay.mock.calls[1][3]).not.toBe(firstUpiKey);
    expect((screen.getByLabelText('UTR / reference number') as HTMLInputElement).value).toBe('UTR123');
  });

  it('can pay cash after cancelling the UPI request, with its own key', async () => {
    pay.mockResolvedValueOnce(sent('PENDING') as never);
    await open();
    fireEvent.click(method('UPI'));
    fireEvent.click(btn('Start UPI payment'));
    await screen.findByText('Waiting for the UPI transfer');
    cancel.mockResolvedValue(rec({ status: 'CANCELLED' }));
    fireEvent.click(btn('Change payment method'));
    fireEvent.click(btn('Yes, change method'));
    await screen.findByLabelText('Cash received');
    pay.mockResolvedValueOnce(sent('CAPTURED', 'pay-3', 'CASH') as never);
    fireEvent.click(btn(/Collect/));
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(pay.mock.calls[1][1]).toBe('CASH');
    expect(pay.mock.calls[1][3]).not.toBe(pay.mock.calls[0][3]);
  });

  it('"Keep waiting" leaves the pending request untouched', async () => {
    pay.mockResolvedValueOnce(sent('PENDING') as never);
    await open();
    fireEvent.click(method('UPI'));
    fireEvent.click(btn('Start UPI payment'));
    await screen.findByText('Waiting for the UPI transfer');
    fireEvent.click(btn('Change payment method'));
    fireEvent.click(btn('Keep waiting for UPI'));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Change the payment method?' })).toBeNull();
    expect(btn('Change payment method')).toBeTruthy();
  });

  it('when the guest paid in the meantime (cancel answers 409) it shows the bill as paid and never takes cash', async () => {
    pay.mockResolvedValueOnce(sent('PENDING') as never);
    await open();
    fireEvent.click(method('UPI'));
    fireEvent.click(btn('Start UPI payment'));
    await screen.findByText('Waiting for the UPI transfer');
    cancel.mockRejectedValue({ status: 409, message: 'Payment was captured while you were cancelling it' });
    list.mockResolvedValue([rec({ status: 'CAPTURED', referenceCode: 'U1' })]);
    fireEvent.click(btn('Change payment method'));
    fireEvent.click(btn('Yes, change method'));
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('keeps the UPI request when the cancel cannot be confirmed (network) and the server still shows it pending', async () => {
    pay.mockResolvedValueOnce(sent('PENDING') as never);
    await open();
    fireEvent.click(method('UPI'));
    fireEvent.click(btn('Start UPI payment'));
    await screen.findByText('Waiting for the UPI transfer');
    cancel.mockRejectedValue(new TypeError('Failed to fetch'));
    list.mockResolvedValue([rec()]);
    fireEvent.click(btn('Change payment method'));
    fireEvent.click(btn('Yes, change method'));
    expect(await screen.findByText(/Could not confirm that the UPI request was cancelled/)).toBeTruthy();
    expect(screen.getByText('Waiting for the UPI transfer')).toBeTruthy();
    expect(off(method('Cash'))).toBe(true);
  });

  it('opens on UPI when the waiter\'s payment QR screen asks for it', async () => {
    await open('UPI');
    expect(method('UPI').getAttribute('aria-pressed')).toBe('true');
    expect(btn('Start UPI payment')).toBeTruthy();
  });
});
