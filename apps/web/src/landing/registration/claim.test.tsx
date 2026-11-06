import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAIM_COPY, CLAIM_MAX_POLLS, claimDelay, clearPayerSecret, issueClaim, lastFourDigits, recallPayerSecret, rememberPayerSecret, setPasswordHref, supportWhatsAppUrl } from './claim';
import { PAY_COPY, requestPayLink } from './payNow';
import { RegistrationTicket } from './Ticket';

const reply = (status: number, body?: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => (body === undefined ? Promise.reject(new SyntaxError('x')) : Promise.resolve(body)) }) as unknown as Response;
const opts = (fetchImpl: ReturnType<typeof vi.fn>) => ({ fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'http://api.test' });
const WHO = { referenceCode: 'NX-7K2Q9M', phoneLast4: '1522' };
const TOKEN = 'tok_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('claim client', () => {
  it('sends the reference code, last four digits and payer secret (no email), with no cookies', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' }));
    expect(await issueClaim(WHO, 'sec', opts(f))).toEqual({ kind: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/public/claim/issue');
    expect(JSON.parse(init.body as string)).toEqual({ referenceCode: 'NX-7K2Q9M', phoneLast4: '1522', payerSecret: 'sec' });
    expect(init.credentials).toBe('omit');
  });

  it('maps pending, manual, 429, 404 and every odd answer', async () => {
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(200, { status: 'pending' }))))).toEqual({ kind: 'pending', paid: false });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(200, { status: 'pending', paid: true }))))).toEqual({ kind: 'pending', paid: true });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(200, { status: 'manual' }))))).toEqual({ kind: 'manual' });
    expect(await issueClaim(WHO, 's', opts(vi.fn().mockResolvedValue(reply(429))))).toEqual({ kind: 'rateLimited' });
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

  it('takes the last four digits from a phone in any format, and none from a short one', () => {
    expect(lastFourDigits('+91 97145 71522')).toBe('1522');
    expect(lastFourDigits('9714571522')).toBe('1522');
    expect(lastFourDigits('12')).toBe('');
  });

  it('backs off 3s, 6s, then 10s', () => {
    expect([1, 2, 3, 4, 9].map(claimDelay)).toEqual([3_000, 6_000, 10_000, 10_000, 10_000]);
    expect(CLAIM_MAX_POLLS).toBe(15);
  });

  it('builds a support WhatsApp link with the message in it', () => {
    const url = supportWhatsAppUrl('my link expired');
    expect(url.startsWith('https://wa.me/')).toBe(true);
    expect(decodeURIComponent(url)).toContain('my link expired');
  });
});

describe('pay-link contract: no secret ever comes from Pay now', () => {
  const link = { linkUrl: 'https://payments-test.cashfree.com/links/x', amountPaise: 5 };
  it('ignores any secret in the response (the payer secret is minted at registration)', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { outcome: 'link', link: { ...link, payerSecret: 'inner' }, payerSecret: 'top' }));
    expect(await requestPayLink({ referenceCode: 'NX-1', email: 'a@b.co' }, opts(f))).toEqual({ kind: 'link', link });
  });
  it('reads the real API shape: just the link fields', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { outcome: 'link', link }));
    expect(await requestPayLink({ referenceCode: 'NX-1', email: 'a@b.co' }, opts(f))).toEqual({ kind: 'link', link });
  });
});

describe('the payer secret in this browser', () => {
  it('is forgotten with clearPayerSecret', () => {
    rememberPayerSecret('NX-7K2Q9M', 'sec-1234567890123456');
    expect(recallPayerSecret('NX-7K2Q9M')).toBe('sec-1234567890123456');
    clearPayerSecret('NX-7K2Q9M');
    expect(recallPayerSecret('NX-7K2Q9M')).toBeNull();
  });
});

function ticket(fetchImpl: ReturnType<typeof vi.fn>) {
  return render(
    <MemoryRouter>
      <RegistrationTicket
        contactName="Asha"
        restaurantName="Ananda Cafe"
        referenceCode="NX-7K2Q9M"
        begin="pay-and-start"
        email="Asha@Example.com"
        phone="+91 97145 71522"
        planKey="floor"
        payOptions={opts(fetchImpl)}
        onReset={() => undefined}
      />
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
const issueCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => String(c[0]).endsWith('/claim/issue'));

describe('RegistrationTicket: claim the account after paying', () => {
  it('with the payer secret: sends the last four digits, shows only "Payment received" and then "Set your password"', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const f = server([reply(200, { status: 'ready', token: TOKEN, expiresAt: '2026-11-10T00:00:00Z' })]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    fireEvent.click(await screen.findByRole('button', { name: CLAIM_COPY.button }));
    expect(assign).toHaveBeenCalledWith(`/set-password#t=${TOKEN}`);
    const issue = issueCalls(f)[0] as unknown as [string, RequestInit];
    expect(JSON.parse(issue[1].body as string)).toEqual({ referenceCode: 'NX-7K2Q9M', phoneLast4: '1522', payerSecret: 'secret-1' });
    expect(document.body.textContent).not.toContain(TOKEN);
    // No contradiction: the page does not also promise a WhatsApp message.
    expect(screen.getByTestId('pay-now').textContent).toContain(PAY_COPY.paid);
    expect(screen.getByTestId('pay-now').textContent).not.toContain('message you');
  });

  it('has exactly one live status region inside the ticket', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    ticket(server([]));
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    await screen.findByTestId('claim');
    expect(document.querySelectorAll('.lp-ticket [role="status"]')).toHaveLength(1);
  });

  it('without a payer secret: explains the other device, offers WhatsApp, never asks the server for a link', async () => {
    const f = server([]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    const claim = await screen.findByTestId('claim');
    expect(claim.textContent).toContain(CLAIM_COPY.later);
    expect(screen.getByTestId('pay-now').textContent).toContain(PAY_COPY.paidWhatsApp);
    expect(claim.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
    expect(issueCalls(f)).toHaveLength(0);
  });

  it('a 404 means "not for you": falls back to WhatsApp', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'wrong');
    ticket(server([reply(404)]));
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    expect((await screen.findByTestId('claim')).textContent).toContain(CLAIM_COPY.later);
  });

  it('"manual" stops the wait at once and says a person is finishing the account', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    const f = server([reply(200, { status: 'manual' })]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    await waitFor(() => expect(screen.getByTestId('claim').textContent).toContain(CLAIM_COPY.manual));
    expect(issueCalls(f)).toHaveLength(1);
  });

  it('stops polling on 429 and tells the owner to wait or WhatsApp, with a way to try again', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = server([reply(200, { status: 'pending' }), reply(429)]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    await screen.findByTestId('claim');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(claimDelay(1));
    });
    await waitFor(() => expect(screen.getByTestId('claim').textContent).toContain(CLAIM_COPY.rateLimited));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(issueCalls(f)).toHaveLength(2);
    expect(screen.getByRole('button', { name: CLAIM_COPY.retry })).toBeTruthy();
  });

  it('while the account is being built it says so, shows the other-device hint, and backs off until the link is ready', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = server([reply(200, { status: 'pending' }), reply(200, { status: 'pending' }), reply(200, { status: 'ready', token: TOKEN, expiresAt: '' })]);
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    const claim = await screen.findByTestId('claim');
    expect(claim.textContent).toContain(CLAIM_COPY.pending);
    expect(claim.textContent).toContain(CLAIM_COPY.otherDevice);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(claimDelay(1));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(claimDelay(2));
    });
    expect(await screen.findByRole('button', { name: CLAIM_COPY.button })).toBeTruthy();
    expect(issueCalls(f)).toHaveLength(3);
  });

  it('gives up after about two minutes, offers "Check again" and WhatsApp, and Check again restarts the wait', async () => {
    rememberPayerSecret('NX-7K2Q9M', 'secret-1');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = server([]); // always pending
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    await screen.findByTestId('claim');
    for (let attempt = 1; attempt < CLAIM_MAX_POLLS; attempt += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(claimDelay(attempt));
      });
    }
    await waitFor(() => expect(screen.getByTestId('claim').textContent).toContain(CLAIM_COPY.timedOut));
    expect(issueCalls(f)).toHaveLength(CLAIM_MAX_POLLS);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(issueCalls(f)).toHaveLength(CLAIM_MAX_POLLS);
    expect(screen.getByTestId('claim').querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: CLAIM_COPY.retry }));
    await waitFor(() => expect(issueCalls(f)).toHaveLength(CLAIM_MAX_POLLS + 1));
  });

  it('Pay now stores nothing: the secret comes from the registration, not from the pay link', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const f = vi.fn(async (url: string) =>
      url.endsWith('/config')
        ? reply(200, { customerPay: true })
        : reply(200, { outcome: 'link', link: { linkUrl: 'https://payments-test.cashfree.com/links/x', amountPaise: 5 } }),
    );
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.button }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(recallPayerSecret('NX-7K2Q9M')).toBeNull();
  });
});
