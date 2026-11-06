import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPaid, fetchPayAvailable, PAY_COPY, requestPayLink } from './payNow';
import { RegistrationTicket } from './Ticket';

const reply = (status: number, body?: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => (body === undefined ? Promise.reject(new SyntaxError('x')) : Promise.resolve(body)) }) as unknown as Response;
const opts = (fetchImpl: ReturnType<typeof vi.fn>) => ({ fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'http://api.test' });
const WHO = { referenceCode: 'NX-7K2Q9M', email: 'asha@example.com' };

afterEach(cleanup);

describe('payNow client', () => {
  it('config: on only when the server says customerPay is exactly true; any failure means off', async () => {
    expect(await fetchPayAvailable(opts(vi.fn().mockResolvedValue(reply(200, { customerPay: true }))))).toBe(true);
    expect(await fetchPayAvailable(opts(vi.fn().mockResolvedValue(reply(200, { customerPay: false }))))).toBe(false);
    expect(await fetchPayAvailable(opts(vi.fn().mockResolvedValue(reply(200, { customerPay: 'true' }))))).toBe(false);
    expect(await fetchPayAvailable(opts(vi.fn().mockResolvedValue(reply(500))))).toBe(false);
    expect(await fetchPayAvailable(opts(vi.fn().mockRejectedValue(new Error('offline'))))).toBe(false);
  });

  it('sends only the reference code and email (never a price) and never includes cookies', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { outcome: 'link', link: { linkUrl: 'https://pay.test/l', amountPaise: 100 } }));
    expect(await requestPayLink(WHO, opts(f))).toEqual({ kind: 'link', link: { linkUrl: 'https://pay.test/l', amountPaise: 100 } });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/public/payments/pay-link');
    expect(JSON.parse(init.body as string)).toEqual(WHO);
    expect(init.credentials).toBe('omit');
  });

  it('maps outcomes, and refuses a non-https or malformed link', async () => {
    expect(await requestPayLink(WHO, opts(vi.fn().mockResolvedValue(reply(200, { outcome: 'paid' }))))).toEqual({ kind: 'paid' });
    expect(await requestPayLink(WHO, opts(vi.fn().mockResolvedValue(reply(200, { outcome: 'contact-us' }))))).toEqual({ kind: 'contact-us' });
    expect(await requestPayLink(WHO, opts(vi.fn().mockResolvedValue(reply(200, { outcome: 'link', link: { linkUrl: 'javascript:alert(1)', amountPaise: 1 } }))))).toEqual({ kind: 'failed' });
    expect(await requestPayLink(WHO, opts(vi.fn().mockResolvedValue(reply(404))))).toEqual({ kind: 'failed' });
    expect(await requestPayLink(WHO, opts(vi.fn().mockRejectedValue(new Error('x'))))).toEqual({ kind: 'failed' });
  });

  it('status: true, false or null (could not tell)', async () => {
    expect(await fetchPaid(WHO, opts(vi.fn().mockResolvedValue(reply(200, { paid: true }))))).toBe(true);
    expect(await fetchPaid(WHO, opts(vi.fn().mockResolvedValue(reply(200, { paid: false }))))).toBe(false);
    expect(await fetchPaid(WHO, opts(vi.fn().mockResolvedValue(reply(500))))).toBeNull();
  });
});

function ticket(fetchImpl: ReturnType<typeof vi.fn>, over: { planKey?: string; email?: string } = {}) {
  return render(
    <MemoryRouter>
      <RegistrationTicket
        contactName="Asha"
        restaurantName="Ananda Cafe"
        referenceCode="NX-7K2Q9M"
        begin="pay-and-start"
        email={over.email ?? 'Asha@Example.com'}
        planKey={over.planKey ?? 'floor'}
        payOptions={opts(fetchImpl)}
        onReset={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('RegistrationTicket: Pay now', () => {
  it('shows no Pay now while the server says it is off, and keeps the pay-later promise path', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { customerPay: false }));
    ticket(f);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: PAY_COPY.button })).toBeNull();
    expect(screen.getByRole('link', { name: /Message us on WhatsApp/ }) ?? screen.getByText(/Message us on WhatsApp/)).toBeTruthy();
  });

  it('does not even ask the server for a plan with no fixed price (Many Doors / not sure)', async () => {
    const f = vi.fn();
    ticket(f, { planKey: 'many-doors' });
    expect(f).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pay-now')).toBeNull();
  });

  it('when on: the button asks for the link with the lower-cased email and sends the owner to Cashfree', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const f = vi.fn(async (url: string) =>
      url.endsWith('/config') ? reply(200, { customerPay: true }) : reply(200, { outcome: 'link', link: { linkUrl: 'https://payments-test.cashfree.com/links/x', amountPaise: 5 } }),
    );
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.button }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://payments-test.cashfree.com/links/x'));
    const post = f.mock.calls.find((c) => String(c[0]).endsWith('/pay-link')) as unknown as [string, RequestInit];
    expect(JSON.parse(post[1].body as string)).toEqual({ referenceCode: 'NX-7K2Q9M', email: 'asha@example.com' });
    vi.unstubAllGlobals();
  });

  it('a failure falls back to "we will message you a payment link"', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/config') ? reply(200, { customerPay: true }) : reply(502)));
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.button }));
    expect(await screen.findByText(PAY_COPY.failed)).toBeTruthy();
  });

  it('"I have paid, check" shows the thank-you once the server says paid', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/config') ? reply(200, { customerPay: true }) : reply(200, { paid: true })));
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    expect(await screen.findByText(PAY_COPY.paid)).toBeTruthy();
    expect(screen.queryByRole('button', { name: PAY_COPY.button })).toBeNull();
  });

  it('not paid yet says so, calmly', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/config') ? reply(200, { customerPay: true }) : reply(200, { paid: false })));
    ticket(f);
    fireEvent.click(await screen.findByRole('button', { name: PAY_COPY.check }));
    expect(await screen.findByText(PAY_COPY.notYet)).toBeTruthy();
  });
});
