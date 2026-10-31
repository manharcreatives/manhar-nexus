import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAILURE_MESSAGES } from '../content';
import { resetRegistrationIntent, setRegistrationIntent } from '../hooks/useRegistrationIntent';
import { RegisterForm } from './RegisterForm';

function reply(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(body)),
  } as unknown as Response;
}

const ok = () => reply(202, { ok: true, referenceCode: 'NX-7K2Q9M' });

function setup(fetchImpl: ReturnType<typeof vi.fn>) {
  return render(
    <MemoryRouter>
      <RegisterForm submitOptions={{ fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: 'http://api.test' }} />
    </MemoryRouter>,
  );
}

const field = (label: RegExp): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(label);

function fillValid(): void {
  fireEvent.change(field(/^Restaurant name/), { target: { value: 'Ananda Cafe' } });
  fireEvent.change(field(/^Your name/), { target: { value: 'Asha Patel' } });
  fireEvent.change(field(/^Mobile number/), { target: { value: '+91 97145-71522' } });
  fireEvent.change(field(/^Email/), { target: { value: 'asha@example.com' } });
  fireEvent.change(field(/^City/), { target: { value: 'Visnagar' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the/ }));
}

const submit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Send my request|Sending/ }));
};

beforeEach(() => {
  resetRegistrationIntent();
  // Outside the Founding window so the code field is not prefilled and the payload is deterministic.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-03-01T10:00:00+05:30'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RegisterForm: structure and accessibility', () => {
  it('labels every control and uses the right autocomplete tokens and input modes', () => {
    setup(vi.fn());
    expect(field(/^Restaurant name/).getAttribute('autocomplete')).toBe('organization');
    expect(field(/^Your name/).getAttribute('autocomplete')).toBe('name');
    expect(field(/^Mobile number/).getAttribute('autocomplete')).toBe('tel');
    expect(field(/^Mobile number/).getAttribute('inputmode')).toBe('tel');
    expect(field(/^Email/).getAttribute('autocomplete')).toBe('email');
    expect(field(/^Email/).getAttribute('inputmode')).toBe('email');
    expect(field(/^City/).getAttribute('autocomplete')).toBe('address-level2');
    expect(field(/^Number of outlets/).getAttribute('inputmode')).toBe('numeric');
    for (const control of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      if (control.closest('.lp-reg-hp')) continue;
      expect(control.id, 'every visible control has an id').not.toBe('');
      expect(document.querySelector(`label[for="${control.id}"]`), `label for #${control.id}`).not.toBeNull();
    }
  });

  it('has a honeypot named website that is out of sight, out of the tab order and empty', () => {
    const { container } = setup(vi.fn());
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap).not.toBeNull();
    expect(trap?.tabIndex).toBe(-1);
    expect(trap?.getAttribute('autocomplete')).toBe('off');
    expect(trap?.value).toBe('');
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap?.closest('.lp-reg-hp')).not.toBeNull();
  });

  it('links the consent text to /terms, /privacy and /refund-policy in new tabs', () => {
    setup(vi.fn());
    const label = document.querySelector('label[for="reg-consent"]') as HTMLElement;
    const links = Array.from(label.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/terms', '/privacy', '/refund-policy']);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });
});

describe('RegisterForm: prefill from the registration intent', () => {
  it('preselects plan and billing cycle from the Pricing choice', () => {
    setRegistrationIntent({ plan: 'pass', cycle: 'monthly' });
    setup(vi.fn());
    expect((field(/^Plan you/) as unknown as HTMLSelectElement).value).toBe('pass');
    expect((field(/^Billing/) as unknown as HTMLSelectElement).value).toBe('monthly');
  });

  it('switches "how to begin" to a live demo when the visitor chose Book a live demo', () => {
    setRegistrationIntent({ begin: 'demo' });
    setup(vi.fn());
    expect((field(/^How would you like/) as unknown as HTMLSelectElement).value).toBe('demo');
  });

  it('follows later intent changes (a plan button pressed after the form is on screen)', () => {
    setup(vi.fn());
    act(() => setRegistrationIntent({ plan: 'floor', cycle: 'yearly' }));
    expect((field(/^Plan you/) as unknown as HTMLSelectElement).value).toBe('floor');
  });

  it('writes a manual plan change back to the shared intent', () => {
    setup(vi.fn());
    fireEvent.change(field(/^Plan you/), { target: { value: 'counter' } });
    expect((field(/^Plan you/) as unknown as HTMLSelectElement).value).toBe('counter');
  });

  it('offers Many Doors when four or more outlets are entered', () => {
    setup(vi.fn());
    fireEvent.change(field(/^Number of outlets/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose Many Doors' }));
    expect((field(/^Plan you/) as unknown as HTMLSelectElement).value).toBe('many-doors');
  });
});

describe('RegisterForm: validation', () => {
  it('shows an error summary, focuses it, marks fields invalid and does not call the API', () => {
    const fetchImpl = vi.fn();
    setup(fetchImpl);
    submit();
    const summary = screen.getByRole('alert');
    expect(summary.textContent).toMatch(/6 things need your attention/);
    expect(document.activeElement).toBe(summary);
    const email = field(/^Email/);
    expect(email.getAttribute('aria-invalid')).toBe('true');
    const describedBy = email.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('reg-email-error');
    expect(document.getElementById('reg-email-error')?.textContent).toMatch(/email/i);
    expect(fetchImpl).not.toHaveBeenCalled();
    // The summary links move focus to the field.
    fireEvent.click(within(summary).getByText(/email/i));
    expect(document.activeElement).toBe(email);
  });

  it('validates on blur and clears the message as soon as the value is fixed', () => {
    setup(vi.fn());
    const email = field(/^Email/);
    fireEvent.change(email, { target: { value: 'asha@' } });
    expect(email.getAttribute('aria-invalid')).toBe('false');
    fireEvent.blur(email);
    expect(email.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(email, { target: { value: 'asha@example.com' } });
    expect(email.getAttribute('aria-invalid')).toBe('false');
    expect(document.getElementById('reg-email-error')).toBeNull();
  });

  it('tidies a valid phone number on blur and rejects a non-Indian one', () => {
    setup(vi.fn());
    const phone = field(/^Mobile number/);
    fireEvent.change(phone, { target: { value: '+91 97145-71522' } });
    fireEvent.blur(phone);
    expect(phone.value).toBe('97145 71522');
    fireEvent.change(phone, { target: { value: '+1 415 555 0100' } });
    fireEvent.blur(phone);
    expect(phone.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('RegisterForm: submitting', () => {
  it('posts the contract payload and shows the reference code in a live status region', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    setup(fetchImpl);
    fillValid();
    submit();

    const code = await screen.findByTestId('reference-code');
    expect(code.textContent).toBe('NX-7K2Q9M');
    expect(screen.getByRole('status').textContent).toContain('NX-7K2Q9M');
    expect(screen.getByText('RECEIVED')).toBeTruthy();
    expect(screen.queryByText('PAID')).toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/public/registrations');
    expect(init.credentials).toBe('omit');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        'billingCycle',
        'businessKind',
        'city',
        'consent',
        'consentVersion',
        'contactName',
        'email',
        'message',
        'outlets',
        'phone',
        'planKey',
        'restaurantName',
        'startedAt',
        'website',
      ].sort(),
    );
    expect(body).toMatchObject({
      restaurantName: 'Ananda Cafe',
      contactName: 'Asha Patel',
      email: 'asha@example.com',
      phone: '+919714571522',
      city: 'Visnagar',
      businessKind: 'restaurant',
      outlets: 1,
      planKey: 'not-sure',
      billingCycle: 'yearly',
      consent: true,
      consentVersion: '2026-10-31',
      website: '',
    });
    expect(typeof body.startedAt).toBe('number');
    expect(body.message).toBe('[Begin: Pay and start]');
  });

  it('sends the plan chosen on the pricing cards', async () => {
    setRegistrationIntent({ plan: 'floor', cycle: 'monthly' });
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    setup(fetchImpl);
    fillValid();
    submit();
    await screen.findByTestId('reference-code');
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ planKey: 'floor', billingCycle: 'monthly' });
  });

  it('leaves the honeypot untouched when a human fills the form', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const { container } = setup(fetchImpl);
    fillValid();
    expect(container.querySelector<HTMLInputElement>('input[name="website"]')?.value).toBe('');
    submit();
    await screen.findByTestId('reference-code');
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string) as { website: string };
    expect(body.website).toBe('');
  });

  it('passes a filled honeypot through (the server treats it as spam) instead of hiding it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const { container } = setup(fetchImpl);
    fillValid();
    fireEvent.change(container.querySelector('input[name="website"]') as HTMLInputElement, { target: { value: 'http://spam.example' } });
    submit();
    await screen.findByTestId('reference-code');
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string) as { website: string };
    expect(body.website).toBe('http://spam.example');
  });

  it('disables the button and marks the form busy while the request is in flight', async () => {
    let resolve: (r: Response) => void = () => undefined;
    const fetchImpl = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { container } = setup(fetchImpl);
    fillValid();
    submit();
    const button = screen.getByRole('button', { name: /Sending/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button); // ignored while busy
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(ok());
    });
    expect(await screen.findByTestId('reference-code')).toBeTruthy();
  });
});

describe('RegisterForm: failures and the Tier-0 fallback', () => {
  const cases: [string, () => Response | Promise<Response>, string][] = [
    ['429 rate limit', () => reply(429, {}), FAILURE_MESSAGES['rate-limit']],
    ['500 server error', () => reply(500), FAILURE_MESSAGES.server],
  ];

  it.each(cases)('%s shows a calm message and the WhatsApp and email fallbacks', async (_name, make, message) => {
    const fetchImpl = vi.fn().mockImplementation(async () => make());
    setup(fetchImpl);
    fillValid();
    submit();
    const alert = await waitFor(() => {
      const el = screen.getAllByRole('alert').find((a) => a.className.includes('lp-reg-failure'));
      if (!el) throw new Error('no failure alert yet');
      return el;
    });
    expect(alert.textContent).toContain(message);
    expectFallbackLinks(alert);
    // The form keeps what was typed and can be sent again.
    expect(field(/^Restaurant name/).value).toBe('Ananda Cafe');
    expect((screen.getByRole('button', { name: /Send my request/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('network failure shows the network message and the fallbacks', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    setup(fetchImpl);
    fillValid();
    submit();
    const alert = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.lp-reg-failure');
      if (!el) throw new Error('no failure alert yet');
      return el;
    });
    expect(alert.textContent).toContain(FAILURE_MESSAGES.network);
    expectFallbackLinks(alert);
  });

  it('retrying after a failure can succeed', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(ok());
    setup(fetchImpl);
    fillValid();
    submit();
    await waitFor(() => expect(document.querySelector('.lp-reg-failure')).not.toBeNull());
    submit();
    expect(await screen.findByTestId('reference-code')).toBeTruthy();
    expect(document.querySelector('.lp-reg-failure')).toBeNull();
  });
});

function expectFallbackLinks(alert: HTMLElement): void {
  const wa = within(alert).getByRole('link', { name: /Send this on WhatsApp/ });
  const waHref = wa.getAttribute('href') ?? '';
  expect(waHref.startsWith('https://wa.me/919714571522?text=')).toBe(true);
  const waText = decodeURIComponent(waHref.split('?text=')[1] ?? '');
  expect(waText).toContain('Restaurant: Ananda Cafe');
  expect(waText).toContain('Mobile: +91 97145-71522');
  expect(waText).toContain('Email: asha@example.com');
  expect(waText).not.toMatch(/website/i);
  expect(wa.getAttribute('target')).toBe('_blank');

  const mail = within(alert).getByRole('link', { name: /Email these details/ });
  const mailHref = mail.getAttribute('href') ?? '';
  expect(mailHref.startsWith('mailto:info@manharcreatives.com?subject=')).toBe(true);
  expect(mailHref).toContain(`subject=${encodeURIComponent('Register Ananda Cafe on Manhar Nexus')}`);
  const body = decodeURIComponent(mailHref.split('&body=')[1] ?? '');
  expect(body).toContain('Restaurant: Ananda Cafe');
  expect(mailHref).not.toContain('\n');
}

describe('RegisterForm: confirmation ticket', () => {
  it('copies the reference, offers a WhatsApp follow-up with the code, and can start over', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup(vi.fn().mockResolvedValue(ok()));
    fillValid();
    submit();
    await screen.findByTestId('reference-code');

    expect(document.activeElement?.textContent).toMatch(/Request received/);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole('button', { name: /Copy reference/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('NX-7K2Q9M'));
    expect(await screen.findByText('Reference copied.')).toBeTruthy();

    const wa = screen.getByRole('link', { name: /Message us on WhatsApp/ });
    expect(decodeURIComponent(wa.getAttribute('href') ?? '')).toContain('Reference: NX-7K2Q9M');

    fireEvent.click(screen.getByRole('button', { name: 'Register another restaurant' }));
    expect(screen.queryByTestId('reference-code')).toBeNull();
    expect(field(/^Restaurant name/).value).toBe('');
  });
});
