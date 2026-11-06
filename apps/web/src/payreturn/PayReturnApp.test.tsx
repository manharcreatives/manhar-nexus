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
});
