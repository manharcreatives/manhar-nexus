import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { claimDelay, rememberPayerSecret } from '../landing/registration/claim';
import PayReturnApp from './PayReturnApp';
import { isPayReturnPath, referenceCodeFromSearch } from './path';

const TOKEN = 'tok_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const reply = (status: number, body?: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body ?? {}) }) as unknown as Response;
const fetchMock = vi.fn();

function open(search: string) {
  window.history.replaceState(null, '', `/pay/return${search}`);
}
async function enter(digits: string) {
  fireEvent.change(await screen.findByLabelText('Last 4 digits of your mobile number'), { target: { value: digits } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}
const issueCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/claim/issue'));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
});

describe('pay-return path helpers', () => {
  it('recognises only /pay/return', () => {
    expect(isPayReturnPath('/pay/return')).toBe(true);
    expect(isPayReturnPath('/pay/return/')).toBe(true);
    expect(isPayReturnPath('/pay/autopay/abc')).toBe(false);
    expect(isPayReturnPath('/pay/returned')).toBe(false);
  });
  it('reads a sensible code only', () => {
    expect(referenceCodeFromSearch('?code=nx-7k2q9m')).toBe('NX-7K2Q9M');
    expect(referenceCodeFromSearch('')).toBeNull();
    expect(referenceCodeFromSearch('?code=<script>')).toBeNull();
  });
});

describe('/pay/return', () => {
  it('is noindex and loads nothing from third parties', () => {
    open('?code=NX-7K2Q9M');
    render(<PayReturnApp />);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('without a code: says so and offers WhatsApp', () => {
    open('');
    render(<PayReturnApp />);
    expect(screen.getByRole('alert').textContent).toContain('could not find your reference code');
    expect(document.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });

  it('on another device (no payer secret): explains it and offers WhatsApp, and asks the server nothing', () => {
    open('?code=NX-7K2Q9M');
    render(<PayReturnApp />);
    expect(screen.getByRole('status').textContent).toContain('open this page on the same phone or computer where you paid');
    expect(document.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for exactly 4 digits (numeric keyboard) before calling the server', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    render(<PayReturnApp />);
    const input = (await screen.findByLabelText('Last 4 digits of your mobile number')) as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('numeric');
    await enter('12a');
    expect(await screen.findByText('Enter exactly 4 digits.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the code, digits and secret (no email) and goes to /set-password with the token in the fragment', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' }));
    render(<PayReturnApp />);
    await enter('1522');
    const link = await screen.findByRole('link', { name: 'Set your password' });
    expect(link.getAttribute('href')).toBe(`/set-password#t=${TOKEN}`);
    const [, init] = issueCalls()[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ referenceCode: 'NX-7K2Q9M', phoneLast4: '1522', payerSecret: 'secret-1' });
    expect(window.location.search + window.location.hash).not.toContain(TOKEN);
  });

  it('a 404 says the details did not match and lets the owner try again', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(404));
    render(<PayReturnApp />);
    await enter('0000');
    expect(await screen.findByText(/did not match/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('"manual" says a person is finishing it and offers WhatsApp', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'manual' }));
    render(<PayReturnApp />);
    await enter('1522');
    expect(await screen.findByText(/finishing your account by hand/)).toBeTruthy();
    expect(document.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });

  it('keeps polling with backoff while pending, then stops at 429 with a friendly message and a retry', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValueOnce(reply(200, { status: 'pending' })).mockResolvedValueOnce(reply(429));
    render(<PayReturnApp />);
    await enter('1522');
    expect(await screen.findByText(/confirming your payment/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(claimDelay(1));
    });
    expect(await screen.findByText(/Too many tries/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => expect(issueCalls()).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
    expect(document.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });

  it('shows "Payment received" as soon as the server says it is paid, even while the account is still being made', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'pending', paid: true }));
    render(<PayReturnApp />);
    await enter('1522');
    expect(await screen.findByText('Payment received. Thank you!')).toBeTruthy();
    expect(screen.getByText(/confirming your payment|setting up/i)).toBeTruthy();
  });

  it('the heading does not claim a payment before the server has confirmed one', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'pending', paid: false }));
    render(<PayReturnApp />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Open your account');
    await enter('1522');
    await screen.findByText(/confirming your payment/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Open your account');
  });

  it('the heading becomes "Payment received" once the server says it is paid', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'pending', paid: true }));
    render(<PayReturnApp />);
    await enter('1522');
    await screen.findByText('Payment received. Thank you!');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Payment received');
  });

  it('does not say payment received while it is not paid yet', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'pending', paid: false }));
    render(<PayReturnApp />);
    await enter('1522');
    await screen.findByText(/confirming your payment/);
    expect(screen.queryByText('Payment received. Thank you!')).toBeNull();
  });

  it('keeps the digits editable while polling: a corrected number restarts the polling at once', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValueOnce(reply(200, { status: 'pending' })).mockResolvedValue(reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' }));
    render(<PayReturnApp />);
    await enter('0000');
    await screen.findByText(/confirming your payment/);
    const input = screen.getByLabelText('Last 4 digits of your mobile number') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: '1522' } });
    fireEvent.click(screen.getByRole('button', { name: 'Try these digits' }));
    const link = await screen.findByRole('link', { name: 'Set your password' });
    expect(link.getAttribute('href')).toBe('/set-password#t=' + TOKEN);
    const bodies = issueCalls().map((c) => JSON.parse((c[1] as RequestInit).body as string).phoneLast4);
    expect(bodies).toEqual(['0000', '1522']);
  });

  it('removes the payer secret from this browser once the link is ready', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' }));
    render(<PayReturnApp />);
    await enter('1522');
    await screen.findByRole('link', { name: 'Set your password' });
    expect(window.localStorage.getItem('nx.payer.NX-7K2Q9M')).toBeNull();
  });

  it('a typo does not cost the secret, but five "not for you" answers in a row do', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    open('?code=NX-7K2Q9M');
    fetchMock.mockResolvedValue(reply(404));
    render(<PayReturnApp />);
    await enter('0000');
    await screen.findByText(/did not match/);
    expect(window.localStorage.getItem('nx.payer.NX-7K2Q9M')).toBe('secret-1');
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Continue|Try these digits/ }));
      await waitFor(() => expect(issueCalls()).toHaveLength(i + 2));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    await waitFor(() => expect(window.localStorage.getItem('nx.payer.NX-7K2Q9M')).toBeNull());
  });

  it("after five wrong tries it shows the other-device state (not an empty form) and a sign-in link", async () => {
    rememberPayerSecret("NX-7K2Q9M", "secret-1");
    open("?code=NX-7K2Q9M");
    fetchMock.mockResolvedValue(reply(404));
    render(<PayReturnApp />);
    await enter("0000");
    await screen.findByText(/did not match/);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Continue|Try these digits/ }));
      await waitFor(() => expect(issueCalls()).toHaveLength(i + 2));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    expect(await screen.findByText(/can no longer try again/)).toBeTruthy();
    expect(screen.queryByLabelText("Last 4 digits of your mobile number")).toBeNull();
    expect(document.querySelector("a[href^=\"https://wa.me/\"]")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("has the brand header and always offers a way to sign in", () => {
    open("?code=NX-7K2Q9M");
    render(<PayReturnApp />);
    expect(screen.getByRole("link", { name: "Manhar Nexus home" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Already set your password?")).toBeTruthy();
  });

  it("hides the last-4 instruction once the link is ready", async () => {
    rememberPayerSecret("NX-7K2Q9M", "secret-1");
    open("?code=NX-7K2Q9M");
    fetchMock.mockResolvedValue(reply(200, { status: "ready", token: TOKEN, expiresAt: "2099-01-01T00:00:00Z" }));
    render(<PayReturnApp />);
    await enter("1522");
    await screen.findByRole("link", { name: "Set your password" });
    expect(screen.queryByText(/Enter the last 4 digits of the mobile number/)).toBeNull();
  });

  it("says there is a connection problem after three failed calls in a row, and keeps trying", async () => {
    vi.useFakeTimers();
    rememberPayerSecret("NX-7K2Q9M", "secret-1");
    open("?code=NX-7K2Q9M");
    fetchMock.mockResolvedValue(reply(500));
    render(<PayReturnApp />);
    fireEvent.change(screen.getByLabelText("Last 4 digits of your mobile number"), { target: { value: "1522" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(claimDelay(i + 1) + 5);
      });
    }
    expect(screen.getByText("Connection problem, retrying…")).toBeTruthy();
    vi.useRealTimers();
  });
});
