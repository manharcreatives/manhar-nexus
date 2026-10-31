import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FORM_VALUES,
  consentVersion,
  toRegistrationPayload,
  type RegistrationFormValues,
} from '../content';
import { REGISTRATION_PATH, REQUEST_TIMEOUT_MS, apiBase, fieldErrorsFromBody, submitRegistration } from './submit';

const values: RegistrationFormValues = {
  ...DEFAULT_FORM_VALUES,
  restaurantName: ' Ananda Cafe ',
  contactName: 'Asha Patel',
  phone: '+91 97145 71522',
  email: 'asha@example.com',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: '2',
  planKey: 'floor',
  billingCycle: 'yearly',
  message: 'Two outlets, one kitchen.',
  consent: true,
};

function reply(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('payload shape (the 03_PLAN.md contract)', () => {
  it('has exactly the contract keys, the consent version and an empty honeypot', () => {
    const payload = toRegistrationPayload(values, 1_793_000_000_000);
    expect(Object.keys(payload).sort()).toEqual(
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
    expect(payload.consent).toBe(true);
    expect(payload.consentVersion).toBe('2026-10-31');
    expect(payload.consentVersion).toBe(consentVersion);
    expect(payload.website).toBe('');
    expect(payload.startedAt).toBe(1_793_000_000_000);
    expect(payload.phone).toBe('+919714571522');
    expect(payload.restaurantName).toBe('Ananda Cafe');
    expect(payload.outlets).toBe(2);
    expect(typeof payload.outlets).toBe('number');
    expect(payload.planKey).toBe('floor');
    expect(payload.billingCycle).toBe('yearly');
  });

  it('folds how-to-begin, the code and the updates opt-in into message and caps it at 1000 characters', () => {
    const payload = toRegistrationPayload(
      { ...values, begin: 'demo', code: 'FOUNDING26', updates: true, message: 'x'.repeat(2000) },
      1,
    );
    expect(payload.message).toContain('[Begin: Live demo first]');
    expect(payload.message).toContain('[Code: FOUNDING26]');
    expect(payload.message).toContain('[Product updates: yes]');
    expect((payload.message ?? '').length).toBeLessThanOrEqual(1000);
  });
});

describe('submitRegistration', () => {
  const payload = toRegistrationPayload(values, 1_793_000_000_000);

  it('POSTs JSON without credentials to {base}/public/registrations and returns the reference code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(202, { ok: true, referenceCode: 'NX-7K2Q9M' }));
    const result = await submitRegistration(payload, { fetchImpl, baseUrl: 'https://nexus.test/api/' });
    expect(result).toEqual({ ok: true, referenceCode: 'NX-7K2Q9M' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://nexus.test/api${REGISTRATION_PATH}`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('maps 429 to rate-limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(429, { statusCode: 429 }));
    expect(await submitRegistration(payload, { fetchImpl, baseUrl: '/api' })).toEqual({ ok: false, kind: 'rate-limit', status: 429 });
  });

  it.each([500, 502, 503])('maps %i to server', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(status));
    expect(await submitRegistration(payload, { fetchImpl, baseUrl: '/api' })).toEqual({ ok: false, kind: 'server', status });
  });

  it('maps a rejected fetch (offline, CORS) to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await submitRegistration(payload, { fetchImpl, baseUrl: '/api' })).toEqual({ ok: false, kind: 'network' });
  });

  it('treats a 202 without a usable reference code as a server failure', async () => {
    for (const body of [{}, { ok: true }, { referenceCode: 12 }, { referenceCode: '' }, { referenceCode: 'a b' }]) {
      const fetchImpl = vi.fn().mockResolvedValue(reply(202, body));
      expect(await submitRegistration(payload, { fetchImpl, baseUrl: '/api' })).toMatchObject({ ok: false, kind: 'server' });
    }
    const unreadable = vi.fn().mockResolvedValue(reply(202));
    expect(await submitRegistration(payload, { fetchImpl: unreadable, baseUrl: '/api' })).toMatchObject({ ok: false, kind: 'server' });
  });

  it('maps 400 to validation and names the fields the API complained about', async () => {
    const body = {
      statusCode: 400,
      error: { code: 'VALIDATION', details: { issues: [{ path: 'email', message: 'Invalid email' }, { path: 'consentVersion', message: 'x' }] } },
    };
    const fetchImpl = vi.fn().mockResolvedValue(reply(400, body));
    const result = await submitRegistration(payload, { fetchImpl, baseUrl: '/api' });
    expect(result).toMatchObject({ ok: false, kind: 'validation', status: 400 });
    expect(result.ok === false && result.fieldErrors && Object.keys(result.fieldErrors)).toEqual(['email']);
  });

  it('gives up after the timeout (15 s) and reports a network failure', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = submitRegistration(payload, { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: '/api' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toEqual({ ok: false, kind: 'network' });
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('never logs the payload', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    await submitRegistration(payload, { fetchImpl, baseUrl: '/api' });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});

describe('apiBase', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('uses VITE_API_URL when set and trims trailing slashes', () => {
    vi.stubEnv('VITE_API_URL', '/api/');
    expect(apiBase()).toBe('/api');
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    expect(apiBase()).toBe('https://api.example.com');
  });

  it('falls back like auth/api.ts does in dev (API origin) when the variable is unset', () => {
    // No stub: the test environment defines no VITE_API_URL. vitest runs with DEV=true, so the dev fallback applies.
    expect(apiBase()).toMatch(/^(http:\/\/localhost:3000|\/api)$/);
  });
});

describe('fieldErrorsFromBody', () => {
  it('ignores bodies that are not the standard envelope', () => {
    expect(fieldErrorsFromBody(undefined)).toBeUndefined();
    expect(fieldErrorsFromBody({ error: 'x' })).toBeUndefined();
    expect(fieldErrorsFromBody({ error: { details: { issues: [] } } })).toBeUndefined();
  });
});
