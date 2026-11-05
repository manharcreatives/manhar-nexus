// Set BEFORE the app modules load:
//  - TRUST_PROXY=1 lets each request choose its client IP through X-Forwarded-For, so the
//    per-IP throttle and DB caps can be exercised without the tests sharing one source.
//  - A high default throttle keeps the functional tests clear of the 5/hour production
//    limit; the dedicated rate-limit app at the bottom lowers it.
process.env.TRUST_PROXY = '1';
process.env.REGISTRATION_RATE_LIMIT = '1000';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Bindings } from 'pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { DEV_REGISTRATION_IP_SALT } from '../src/config/configuration';
import { baseLogger } from '../src/logging/logger';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { REFERENCE_CODE_PATTERN, hashIp } from '../src/registration/registration.util';

jest.setTimeout(120_000);

/**
 * Public registration requests (ADR-033) — landing-page lead capture.
 *
 * Coverage:
 *   Public POST: 202 + {ok, referenceCode} only; row stored with normalised email, HMAC ipHash
 *     (never the raw IP), truncated user agent, server consent timestamp
 *   Validation 400: unknown key, bad email, consent=false, unknown consentVersion, allow-lists,
 *     bounds; the error never echoes the submitted values
 *   Spam: honeypot and time-trap return the SAME 202 shape but are stored as SPAM
 *   Caps: 3 per email per day and 5 per IP per hour (DB-backed) still answer 202, store nothing
 *   Throttle: 429 on the per-IP limit (own app instance)
 *   Logs: no PII
 *   Platform: list/get/patch are PLATFORM-only (401 / business 403 / platform 200), transitions
 */
describe('Public registrations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformToken: string;
  let businessToken: string;
  let businessId: string;

  const RUN = Date.now().toString(36);
  const EMAIL_TAG = `-${RUN}@example.test`;
  const http = () => app.getHttpServer();
  let seq = 0;
  const octet = (): number => 1 + Math.floor(Math.random() * 253);
  const IP_BASE = `${octet()}.${octet()}`;
  /** A fresh client IP per call (X-Forwarded-For, TRUST_PROXY=1). */
  const freshIp = (): string => `${IP_BASE}.${octet()}.${++seq % 250}`;
  const freshEmail = (): string => `lead${++seq}${EMAIL_TAG}`;

  const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    restaurantName: 'Ananda Cafe',
    contactName: 'Asha Patel',
    email: freshEmail(),
    phone: '+91 97145 71522',
    city: 'Visnagar',
    businessKind: 'cafe',
    outlets: 2,
    planKey: 'floor',
    billingCycle: 'yearly',
    consent: true,
    consentVersion: CONSENT_VERSIONS[0],
    ...over,
  });

  const submit = (b: Record<string, unknown>, ip: string = freshIp(), ua?: string) => {
    const req = request(http()).post('/public/registrations').set('x-forwarded-for', ip);
    if (ua) req.set('user-agent', ua);
    return req.send(b);
  };

  const pGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPatch = (path: string, b: object) =>
    request(http()).patch(path).set('authorization', `Bearer ${platformToken}`).send(b);
  const bGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${businessToken}`);
  const bPatch = (path: string, b: object) =>
    request(http()).patch(path).set('authorization', `Bearer ${businessToken}`).send(b);

  const rowByRef = (referenceCode: string) =>
    prisma.registrationRequest.findUniqueOrThrow({ where: { referenceCode } });

  /** Creates a stored lead through the public endpoint and returns its row. */
  async function createLead(over: Record<string, unknown> = {}) {
    const res = await submit(body(over));
    expect(res.status).toBe(202);
    return rowByRef(res.body.referenceCode as string);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);

    const login = await request(http())
      .post('/auth/login')
      .send({ email: 'platform@manhar.local', password: 'ChangeMe!Dev12345' });
    expect(login.status).toBe(200);
    platformToken = login.body.accessToken as string;

    const biz = await request(http())
      .post('/internal/businesses')
      .set('authorization', `Bearer ${platformToken}`)
      .send({ name: `RegistrationTestBiz ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    businessId = biz.body.id as string;

    const ownerEmail = `reg-owner-${RUN}@test.local`;
    const pw = 'TestReg!Pass123';
    const prov = await request(http())
      .post(`/internal/businesses/${businessId}/provision`)
      .set('authorization', `Bearer ${platformToken}`)
      .send({ email: ownerEmail, displayName: 'Reg Owner', password: pw });
    expect(prov.status).toBe(201);
    const bizLogin = await request(http()).post('/auth/login').send({ email: ownerEmail, password: pw });
    expect(bizLogin.status).toBe(200);
    businessToken = bizLogin.body.accessToken as string;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.registrationRequest.deleteMany({ where: { email: { endsWith: EMAIL_TAG } } });
    }
    if (app) await app.close();
  });

  // ─── Public happy path ────────────────────────────────────────────────────────

  describe('POST /public/registrations', () => {
    it('answers 202 with only {ok, referenceCode} and stores a NEW lead', async () => {
      const ip = freshIp();
      const email = `Mixed.Case${++seq}${EMAIL_TAG}`.replace('example.test', 'EXAMPLE.test');
      const res = await submit(body({ email: `  ${email}  `, message: 'Two outlets, one kitchen.' }), ip, 'jest-agent/1.0');
      expect(res.status).toBe(202);
      expect(Object.keys(res.body).sort()).toEqual(['ok', 'referenceCode']);
      expect(res.body.ok).toBe(true);
      expect(res.body.referenceCode).toMatch(REFERENCE_CODE_PATTERN);

      const row = await rowByRef(res.body.referenceCode as string);
      expect(row.status).toBe('NEW');
      expect(row.email).toBe(email.toLowerCase());
      expect(row.restaurantName).toBe('Ananda Cafe');
      expect(row.planKey).toBe('floor');
      expect(row.billingCycle).toBe('yearly');
      expect(row.outlets).toBe(2);
      expect(row.message).toBe('Two outlets, one kitchen.');
      expect(row.consentVersion).toBe(CONSENT_VERSIONS[0]);
      expect(Math.abs(row.consentAt.getTime() - Date.now())).toBeLessThan(60_000);
      expect(row.userAgent).toBe('jest-agent/1.0');
      expect(row.internalNotes).toBeNull();
      expect(row.businessId).toBeNull();
    });

    it('stores an HMAC of the IP (never the raw address) and truncates the user agent to 200', async () => {
      const ip = freshIp();
      const res = await submit(body(), ip, 'U'.repeat(500));
      expect(res.status).toBe(202);
      const row = await rowByRef(res.body.referenceCode as string);
      expect(row.ipHash).toBe(hashIp(ip, DEV_REGISTRATION_IP_SALT));
      expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(row)).not.toContain(ip);
      expect(row.userAgent).toHaveLength(200);
    });

    it('never echoes input and gives distinct reference codes', async () => {
      const email = freshEmail();
      const res = await submit(body({ email, restaurantName: 'Echo Check Kitchen' }));
      expect(res.status).toBe(202);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(email);
      expect(text).not.toContain('Echo Check');
      const codes = new Set<string>([res.body.referenceCode as string]);
      for (let i = 0; i < 4; i++) {
        const r = await submit(body());
        expect(r.status).toBe(202);
        codes.add(r.body.referenceCode as string);
      }
      expect(codes.size).toBe(5);
    });

    it('is reachable without credentials or cookies and accepts every plan and kind', async () => {
      for (const planKey of ['counter', 'floor', 'pass', 'many-doors', 'not-sure']) {
        const res = await submit(body({ planKey, billingCycle: 'monthly', businessKind: 'other', outlets: 500 }));
        expect(res.status).toBe(202);
      }
    });

    it('does not log personal data', async () => {
      const logged: string[] = [];
      const realChild = baseLogger.child.bind(baseLogger);
      const spy = jest.spyOn(baseLogger, 'child').mockImplementation(((bindings: Bindings) => {
        logged.push(JSON.stringify(bindings));
        const child = realChild(bindings);
        for (const level of ['info', 'warn'] as const) {
          const original = child[level].bind(child) as (...a: unknown[]) => void;
          child[level] = ((...args: unknown[]) => {
            logged.push(args.map(String).join(' '));
            original(...args);
          }) as typeof child.info;
        }
        return child;
      }) as unknown as typeof baseLogger.child);
      try {
        const email = `pii-check${++seq}${EMAIL_TAG}`;
        const res = await submit(body({ email, contactName: 'Zorro Quixote', phone: '+91 98765 43210' }));
        expect(res.status).toBe(202);
        const all = logged.join('\n');
        expect(all).toContain(res.body.referenceCode as string);
        for (const secret of [email, 'Zorro', 'Quixote', '98765', 'Ananda Cafe']) {
          expect(all).not.toContain(secret);
        }
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────────

  describe('validation (400)', () => {
    const rejects = async (over: Record<string, unknown>) => {
      const before = await prisma.registrationRequest.count();
      const res = await submit(body(over));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
      expect(await prisma.registrationRequest.count()).toBe(before);
      return res;
    };

    it('rejects unknown keys (strict)', async () => {
      await rejects({ isAdmin: true });
      await rejects({ status: 'CONVERTED' });
    });

    it('rejects a bad email without echoing it back', async () => {
      const res = await rejects({ email: 'not-an-email-LEAKCHECK' });
      expect(JSON.stringify(res.body)).not.toContain('LEAKCHECK');
    });

    it('requires consent=true and a known consent version', async () => {
      await rejects({ consent: false });
      await rejects({ consent: 'yes' });
      await rejects({ consentVersion: '1999-01-01' });
      const missing = body();
      delete missing.consent;
      expect((await submit(missing)).status).toBe(400);
    });

    it('enforces allow-lists and bounds', async () => {
      await rejects({ planKey: 'enterprise' });
      await rejects({ billingCycle: 'weekly' });
      await rejects({ businessKind: 'spaceship' });
      await rejects({ outlets: 0 });
      await rejects({ outlets: 501 });
      await rejects({ outlets: 2.5 });
      await rejects({ phone: 'call me' });
      await rejects({ restaurantName: 'x' });
      await rejects({ city: 'c'.repeat(81) });
      await rejects({ message: 'm'.repeat(1001) });
    });

    it('rejects non-JSON-object bodies', async () => {
      const res = await request(http())
        .post('/public/registrations')
        .set('x-forwarded-for', freshIp())
        .send(['a']);
      expect(res.status).toBe(400);
    });
  });

  // ─── Spam defences ────────────────────────────────────────────────────────────

  describe('spam defences (uniform 202)', () => {
    it('honeypot: same response shape, stored as SPAM', async () => {
      const normal = await submit(body());
      const trapped = await submit(body({ website: 'http://buy-pills.example' }));
      expect(trapped.status).toBe(202);
      expect(Object.keys(trapped.body).sort()).toEqual(Object.keys(normal.body).sort());
      expect(trapped.body.referenceCode).toMatch(REFERENCE_CODE_PATTERN);
      const row = await rowByRef(trapped.body.referenceCode as string);
      expect(row.status).toBe('SPAM');
      expect(row.internalNotes).toBe('auto: honeypot');
      expect(JSON.stringify(row)).not.toContain('buy-pills');
    });

    it('an empty or blank honeypot is not spam', async () => {
      const a = await submit(body({ website: '' }));
      const b = await submit(body({ website: '   ' }));
      expect((await rowByRef(a.body.referenceCode as string)).status).toBe('NEW');
      expect((await rowByRef(b.body.referenceCode as string)).status).toBe('NEW');
    });

    it('time-trap: a form filled in under 2 seconds is stored as SPAM, still 202', async () => {
      const fast = await submit(body({ startedAt: Date.now() - 500 }));
      expect(fast.status).toBe(202);
      expect(Object.keys(fast.body).sort()).toEqual(['ok', 'referenceCode']);
      const row = await rowByRef(fast.body.referenceCode as string);
      expect(row.status).toBe('SPAM');
      expect(row.internalNotes).toBe('auto: time-trap');

      const future = await submit(body({ startedAt: Date.now() + 60_000 }));
      expect((await rowByRef(future.body.referenceCode as string)).status).toBe('SPAM');
    });

    it('a human-paced startedAt (or none) is accepted as NEW', async () => {
      const slow = await submit(body({ startedAt: Date.now() - 15_000 }));
      expect((await rowByRef(slow.body.referenceCode as string)).status).toBe('NEW');
      const none = await submit(body());
      expect((await rowByRef(none.body.referenceCode as string)).status).toBe('NEW');
    });
  });

  // ─── DB-backed caps ───────────────────────────────────────────────────────────

  describe('DB-backed abuse caps (honest 429, nothing stored, never a reference code)', () => {
    it('allows 3 per email per day, then answers 429 "already have your request" and stores nothing (case-insensitive)', async () => {
      const email = `Capped${++seq}${EMAIL_TAG}`;
      const refs: string[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await submit(body({ email: i % 2 ? email.toUpperCase().replace('EXAMPLE.TEST', 'example.test') : email }));
        expect(res.status).toBe(202);
        expect(Object.keys(res.body).sort()).toEqual(['ok', 'referenceCode']);
        refs.push(res.body.referenceCode as string);
      }
      const over = await submit(body({ email: email.toUpperCase().replace('EXAMPLE.TEST', 'example.test') }));
      expect(over.status).toBe(429);
      expect(over.body.error.code).toBe('RATE_LIMITED');
      expect(over.body.error.details.kind).toBe('email');
      expect(over.body).not.toHaveProperty('referenceCode');
      expect(over.headers['retry-after']).toBeDefined();
      const stored = await prisma.registrationRequest.findMany({ where: { email: email.toLowerCase() } });
      expect(stored).toHaveLength(3);
      expect(stored.map((r) => r.referenceCode).sort()).toEqual(refs.sort());
    });

    it('SPAM rows do not lock a real person out of their own address', async () => {
      const email = `victim${++seq}${EMAIL_TAG}`;
      for (let i = 0; i < 4; i++) {
        expect((await submit(body({ email, website: 'bot' }))).status).toBe(202);
      }
      const real = await submit(body({ email }));
      expect(real.status).toBe(202);
      expect((await rowByRef(real.body.referenceCode as string)).status).toBe('NEW');
    });

    it('allows 5 per IP per hour (all statuses), then answers 429 with Retry-After and stores nothing', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        const res = await submit(i === 2 ? body({ website: 'bot' }) : body(), ip);
        expect(res.status).toBe(202);
      }
      const over = await submit(body(), ip);
      expect(over.status).toBe(429);
      expect(over.body.error.code).toBe('RATE_LIMITED');
      expect(over.body.error.details.kind).toBe('ip');
      expect(over.body).not.toHaveProperty('referenceCode');
      expect(over.headers['retry-after']).toBe('3600');
      const hash = hashIp(ip, DEV_REGISTRATION_IP_SALT)!;
      expect(await prisma.registrationRequest.count({ where: { ipHash: hash } })).toBe(5);
      // A different visitor is unaffected.
      expect((await rowByRef((await submit(body())).body.referenceCode as string)).status).toBe('NEW');
    });
  });

  // ─── Platform management ──────────────────────────────────────────────────────

  describe('GET /internal/registrations (PLATFORM only)', () => {
    it('401 without a token, 403 for a business-realm user, 200 for a platform admin', async () => {
      expect((await request(http()).get('/internal/registrations')).status).toBe(401);
      const denied = await bGet('/internal/registrations');
      expect(denied.status).toBe(403);
      const ok = await pGet('/internal/registrations');
      expect(ok.status).toBe(200);
      expect(Array.isArray(ok.body.items)).toBe(true);
      expect(typeof ok.body.total).toBe('number');
      expect(ok.body.skip).toBe(0);
      expect(ok.body.take).toBe(50);
    });

    it('lists newest first without exposing ipHash, and filters by status', async () => {
      const lead = await createLead({ restaurantName: `ListCheck ${RUN}` });
      const spam = await submit(body({ website: 'bot', restaurantName: `ListSpam ${RUN}` }));
      const all = await pGet('/internal/registrations?take=100');
      expect(all.status).toBe(200);
      const ids = (all.body.items as { id: string }[]).map((i) => i.id);
      expect(ids).toContain(lead.id);
      for (const item of all.body.items as Record<string, unknown>[]) {
        expect(item).not.toHaveProperty('ipHash');
      }
      const created = (all.body.items as { createdAt: string }[]).map((i) => Date.parse(i.createdAt));
      expect([...created].sort((a, b) => b - a)).toEqual(created);

      const onlySpam = await pGet('/internal/registrations?status=SPAM&take=100');
      expect(onlySpam.status).toBe(200);
      expect((onlySpam.body.items as { status: string }[]).every((i) => i.status === 'SPAM')).toBe(true);
      const spamRow = await rowByRef(spam.body.referenceCode as string);
      expect((onlySpam.body.items as { id: string }[]).map((i) => i.id)).toContain(spamRow.id);
      expect((onlySpam.body.items as { id: string }[]).map((i) => i.id)).not.toContain(lead.id);
    });

    it('paginates and validates the query', async () => {
      await createLead();
      await createLead();
      const page = await pGet('/internal/registrations?take=1&skip=1');
      expect(page.status).toBe(200);
      expect(page.body.items).toHaveLength(1);
      expect(page.body.take).toBe(1);
      expect(page.body.skip).toBe(1);
      expect(page.body.total).toBeGreaterThanOrEqual(2);
      expect((await pGet('/internal/registrations?status=BOGUS')).status).toBe(400);
      expect((await pGet('/internal/registrations?take=0')).status).toBe(400);
      expect((await pGet('/internal/registrations?take=101')).status).toBe(400);
      expect((await pGet('/internal/registrations?foo=1')).status).toBe(400);
    });
  });

  describe('GET /internal/registrations/:id', () => {
    it('returns one request to platform staff; 403 business; 404 unknown; 400 malformed id', async () => {
      const lead = await createLead({ message: 'hello' });
      const res = await pGet(`/internal/registrations/${lead.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(lead.id);
      expect(res.body.referenceCode).toBe(lead.referenceCode);
      expect(res.body.message).toBe('hello');
      expect(res.body).not.toHaveProperty('ipHash');
      expect((await bGet(`/internal/registrations/${lead.id}`)).status).toBe(403);
      expect((await pGet('/internal/registrations/00000000-0000-4000-8000-000000000000')).status).toBe(404);
      expect((await pGet('/internal/registrations/not-a-uuid')).status).toBe(400);
    });
  });

  describe('PATCH /internal/registrations/:id', () => {
    it('401 / 403 for non-platform callers and changes nothing', async () => {
      const lead = await createLead();
      const anon = await request(http()).patch(`/internal/registrations/${lead.id}`).send({ status: 'CONTACTED' });
      expect(anon.status).toBe(401);
      expect((await bPatch(`/internal/registrations/${lead.id}`, { status: 'CONTACTED' })).status).toBe(403);
      expect((await rowByRef(lead.referenceCode)).status).toBe('NEW');
    });

    it('moves NEW -> CONTACTED -> QUALIFIED and records owner and notes', async () => {
      const lead = await createLead();
      const a = await pPatch(`/internal/registrations/${lead.id}`, {
        status: 'CONTACTED',
        assignedTo: 'Utsav',
        internalNotes: 'Called on WhatsApp; wants a demo Friday.',
      });
      expect(a.status).toBe(200);
      expect(a.body.status).toBe('CONTACTED');
      expect(a.body.assignedTo).toBe('Utsav');
      expect(a.body.internalNotes).toContain('demo Friday');
      expect(new Date(a.body.updatedAt as string).getTime()).toBeGreaterThanOrEqual(lead.updatedAt.getTime());

      const b = await pPatch(`/internal/registrations/${lead.id}`, { status: 'QUALIFIED' });
      expect(b.status).toBe(200);
      expect(b.body.status).toBe('QUALIFIED');
      expect(b.body.assignedTo).toBe('Utsav'); // untouched fields persist

      const c = await pPatch(`/internal/registrations/${lead.id}`, { assignedTo: null });
      expect(c.status).toBe(200);
      expect(c.body.assignedTo).toBeNull();
      expect(c.body.status).toBe('QUALIFIED');
    });

    it('converts with a businessId, then CONVERTED is terminal', async () => {
      const lead = await createLead();
      const res = await pPatch(`/internal/registrations/${lead.id}`, { status: 'CONVERTED', businessId });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONVERTED');
      expect(res.body.businessId).toBe(businessId);
      const back = await pPatch(`/internal/registrations/${lead.id}`, { status: 'NEW' });
      expect(back.status).toBe(400);
      expect(back.body.error.code).toBe('VALIDATION');
      expect((await rowByRef(lead.referenceCode)).status).toBe('CONVERTED');
    });

    it('rejects businessId unless the request is CONVERTED, and unknown businesses', async () => {
      const lead = await createLead();
      expect((await pPatch(`/internal/registrations/${lead.id}`, { businessId })).status).toBe(400);
      const unknown = await pPatch(`/internal/registrations/${lead.id}`, {
        status: 'CONVERTED',
        businessId: '00000000-0000-4000-8000-000000000000',
      });
      expect(unknown.status).toBe(404);
      expect((await rowByRef(lead.referenceCode)).status).toBe('NEW');
    });

    it('lets staff recover a false-positive SPAM, but not skip straight to CONVERTED', async () => {
      const spam = await submit(body({ website: 'oops-real-person-autofill' }));
      const row = await rowByRef(spam.body.referenceCode as string);
      expect(row.status).toBe('SPAM');
      expect((await pPatch(`/internal/registrations/${row.id}`, { status: 'CONVERTED' })).status).toBe(400);
      const reopened = await pPatch(`/internal/registrations/${row.id}`, { status: 'NEW' });
      expect(reopened.status).toBe(200);
      expect(reopened.body.status).toBe('NEW');
      const rejected = await pPatch(`/internal/registrations/${row.id}`, { status: 'REJECTED' });
      expect(rejected.body.status).toBe('REJECTED');
    });

    it('validates the body: empty, unknown keys, bad enum, protected fields', async () => {
      const lead = await createLead();
      const url = `/internal/registrations/${lead.id}`;
      expect((await pPatch(url, {})).status).toBe(400);
      expect((await pPatch(url, { status: 'ARCHIVED' })).status).toBe(400);
      expect((await pPatch(url, { email: 'x@y.z' })).status).toBe(400);
      expect((await pPatch(url, { ipHash: 'abc' })).status).toBe(400);
      expect((await pPatch(url, { internalNotes: 'n'.repeat(4001) })).status).toBe(400);
      expect((await pPatch('/internal/registrations/00000000-0000-4000-8000-000000000000', { status: 'CONTACTED' })).status).toBe(404);
      expect((await pPatch('/internal/registrations/nope', { status: 'CONTACTED' })).status).toBe(400);
    });
  });
});

/**
 * Separate app instance: its own in-memory throttler store, with a tiny limit, so the
 * 429 path is proven without disturbing the functional suite above.
 */
describe('Public registrations — per-IP throttle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const RUN = Date.now().toString(36);
  const EMAIL_TAG = `-rl${RUN}@example.test`;
  let seq = 0;
  const ipA = `203.0.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;
  const ipB = `198.51.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;

  const payload = () => ({
    restaurantName: 'Throttle Test Kitchen',
    contactName: 'Rate Limit',
    email: `t${++seq}${EMAIL_TAG}`,
    phone: '9714571522',
    city: 'Visnagar',
    businessKind: 'restaurant',
    outlets: 1,
    planKey: 'counter',
    billingCycle: 'monthly',
    consent: true,
    consentVersion: CONSENT_VERSIONS[0],
  });
  const post = (ip: string) =>
    request(app.getHttpServer()).post('/public/registrations').set('x-forwarded-for', ip).send(payload());

  beforeAll(async () => {
    process.env.REGISTRATION_RATE_LIMIT = '3';
    process.env.REGISTRATION_RATE_TTL_MS = '3600000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    process.env.REGISTRATION_RATE_LIMIT = '1000';
    if (prisma) await prisma.registrationRequest.deleteMany({ where: { email: { endsWith: EMAIL_TAG } } });
    if (app) await app.close();
  });

  it('returns 429 (standard envelope, nothing stored) once one IP exceeds the limit; other IPs are unaffected', async () => {
    const statuses: number[] = [];
    let last: request.Response | undefined;
    for (let i = 0; i < 5; i++) {
      last = await post(ipA);
      statuses.push(last.status);
    }
    expect(statuses).toEqual([202, 202, 202, 429, 429]);
    expect(last?.body.statusCode).toBe(429);
    expect(last?.body.error).toBeDefined();
    expect(last?.body).not.toHaveProperty('referenceCode');
    expect(await prisma.registrationRequest.count({ where: { email: { endsWith: EMAIL_TAG } } })).toBe(3);

    expect((await post(ipB)).status).toBe(202);
  });
});
