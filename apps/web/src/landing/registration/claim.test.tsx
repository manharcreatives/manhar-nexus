import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAIM_COPY, CLAIM_MAX_POLLS, CLAIM_POLL_MS, issueClaim, recallPayerSecret, rememberPayerSecret, setPasswordHref } from './claim';
import { PAY_COPY } from './payNow';
import { RegistrationTicket } from './Ticket';

const reply = (status: number, body?: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => (body === undefined ? Promise.reject(new SyntaxError('x')) : Promise.resolve(body)) }) as unknown as Response;
const opts = (fetchImpl: ReturnType<typeof vi.fn>) => ({ fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'http://api.test' });
const WHO = { referenceCode: 'NX-7K2Q9M', email: 'asha@example.com' };
const TOKEN = 'tok_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('claim client', () => {
  it('sends the reference code, email and payer secret, with no cookies', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' }));
    expect(await issueClaim(WHO, 'sec', opts(f))).toEqual({ kind: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/public/claim/issue');
    expect(JSON.parse(init.body as string)).toEqual({ ...WHO, payerSecret: 'sec' });
    expect(init.credentials).toBe('omit');
  });

  it('maps pending, unknown (404) and every odd answer', async () => {
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(200, { status: 'pending' }))))).toEqual({ kind: 'pending' });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(404))))).toEqual({ kind: 'unknown' });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(500))))).toEqual({ kind: 'failed' });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(200, { status: 'ready' }))))).toEqual({ kind: 'failed' });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockRejectedValue(new Error('offline'))))).toEqual({ kind: 'failed' });
  });

  it('keeps the payer secret per reference code, and survives blocked storage', () => {
    expect(recallPayerSecret('NX-1')).toBeNull();
    rememberPayerSecret('NX-1', 'abc');
    expect(recallPayerSecret('NX-1')).toBe('abc');
    expect(recallPayerSecret('NX-2')).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => rememberPayerSecret('NX-1', 'x')).not.toThrow();
    expect(recallPayerSecret('NX-1')).toBeNull();
  });

  it('puts the token in the fragment, never the query string', () => {
    const href = setPasswordHref(TOKEN);
    expect(href).toBe(`/set-password#t=${TOKEN}`);
    expect(href).not.toContain('?');
  });
});

function ticket(fetchImpl: ReturnType<typeof vi.fn>) {
  return render(
    <MemoryRouter>
      <RegistrationTicket contactName="Asha" restaurantName="Ananda Cafe" referenceCode="NX-7K2Q9M" begin="pay-and-start" email="Asha@Example.com" planKey="floor" payOptions={opts(fetchImpl)} onReset={() => undefined} />
    </MemoryRouter>,
  );
}

/** config on, status paid, and a scripted series of claim answers. */
function server(claimAnswers: Response[]) {
  const queue = [...claimAnswers];
  return vi.fn(async (url: string) => {
    if (url.endsWith('/config')) return reply(200, { customerPay: true });
    if (url.endsWith('/status')) return reply(200, { paid: true });
    if (url.endsWith('/claim/issue')) return queue.shift() ?? reply(200, { status: 'pending' });
    return reply(404);
  });
}

describe('RegistrationTicket: claim the account after paying', () => {
  it('with the payer secret: shows "Set your password" and sends the token only in the URL fragment', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const f = server([reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' })]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    fireEvent.click(await screen.findByRole('button', { name: CLAIM_COPY.button }));
    expect(assign).toHaveBeenCalledWith(`/set-password#t=${TOKEN}`);
    const issue = f.mock.calls.find((c) => String(c[0]).endsWith('/claim/issue')) as unknown as [string, RequestInit];
    expect(JSON.parse(issue[1].body as string)).toEqual({ referenceCode: 'NX-7K2Q9M', email: 'asha@example.com', payerSecret: 'secret-1' });
    expect(document.body.textContent).not.toContain(TOKEN);
  });

  it('without a payer secret: says the sign-in link comes on WhatsApp and never asks the server for one', async () => {
    const f = server([]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    expect((await screen.findByTestId('claim')).textContent).toContain(CLAIM_COPY.later);
    expect(f.mock.calls.some((c) => String(c[0]).endsWith('/claim/issue'))).toBe(false);
  });

  it('a 404 for the secret means "not for you": falls back to WhatsApp', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'wrong');
    ticket(server([reply(404)]));
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    expect((await screen.findByTestId('claim')).textContent).toContain(CLAIM_COPY.later);
  });

  it('while the account is being built it says so and polls every 4 seconds until the link is ready', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = server([reply(200, { status: 'pending' }), reply(200, { status: 'pending' }), reply(200, { status: 'ready', token: TOKEN, expiresAt: '' })]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    expect((await screen.findByTestId('claim')).textContent).toContain(CLAIM_COPY.pending);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CLAIM_POLL_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CLAIM_POLL_MS);
    });
    expect(await screen.findByRole('button', { name: CLAIM_COPY.button })).toBeTruthy();
    expect(f.mock.calls.filter((c) => String(c[0]).endsWith('/claim/issue'))).toHaveLength(3);
  });

  it('gives up after about two minutes and promises WhatsApp', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = server([]); // always pending
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    await screen.findByTestId('claim');
    for (let i = 0; i < CLAIM_MAX_POLLS; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CLAIM_POLL_MS);
      });
    }
    await waitFor(() => expect(screen.getByTestId('claim').textContent).toContain(CLAIM_COPY.timedOut));
    const calls = f.mock.calls.filter((c) => String(c[0]).endsWith('/claim/issue')).length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CLAIM_POLL_MS * 3);
    });
    expect(f.mock.calls.filter((c) => String(c[0]).endsWith('/claim/issue'))).toHaveLength(calls);
  });

  it('remembers the payer secret when the pay link is first created', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const f = vi.fn(async (url: string) =>
      url.endsWith('/config')
        ? reply(200, { customerPay: true })
        : reply(200, { outcome: 'link', link: { linkUrl: 'https://payments-test.cashfree.com/links/x', amountPaise: 5 }, payerSecret: 'fresh-secret' }),
    );
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.button }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(recallPayerSecret('NX-7K2Q9M')).toBe('fresh-secret');
  });
});
