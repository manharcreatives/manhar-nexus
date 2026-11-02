import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration tests for Nexus Core against a real PostgreSQL database, now
 * authenticated as the seeded platform admin (ADR-022 — the shared-token bridge
 * is retired). Focus: tenant isolation (ADR-002), settings precedence, audit
 * integrity, gapless numbering. Requires the DB migrated + seeded.
 */
describe('Nexus Core (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const auth = (r: request.Test): request.Test => r.set('authorization', `Bearer ${token}`);
  const http = (): string => app.getHttpServer();

  async function createBusiness(name: string, businessTypeKey = 'restaurant'): Promise<string> {
    const res = await auth(
      request(http()).post('/internal/businesses').send({ name, businessTypeKey }),
    ).expect(201);
    return res.body.id as string;
  }

  async function createLocation(businessId: string, name: string, code?: string): Promise<string> {
    const res = await auth(
      request(http()).post(`/internal/businesses/${businessId}/locations`).send({ name, code }),
    ).expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    // Authenticate as the seeded platform admin.
    const email = process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local';
    const password = process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345';
    const res = await request(http()).post('/auth/login').send({ email, password }).expect(200);
    token = res.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('platform auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(http()).get('/internal/business-types').expect(401);
    });

    it('rejects a malformed bearer token with 401', async () => {
      await request(http())
        .get('/internal/business-types')
        .set('authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('accepts the platform admin token', async () => {
      const res = await auth(request(http()).get('/internal/business-types')).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((t: { key: string }) => t.key === 'restaurant')).toBe(true);
    });
  });

  describe('business + location + audit', () => {
    it('creates a business with an audited, verifiable chain', async () => {
      const id = await createBusiness('Audit Co');
      await createLocation(id, 'Main', 'MAIN');

      const audit = await auth(request(http()).get(`/internal/businesses/${id}/audit`)).expect(200);
      const actions = audit.body.map((e: { action: string }) => e.action);
      expect(actions).toContain('business.created');
      expect(actions).toContain('location.created');

      const verify = await auth(
        request(http()).get(`/internal/businesses/${id}/audit/verify`),
      ).expect(200);
      expect(verify.body).toEqual({ valid: true, count: expect.any(Number) });
      expect(verify.body.count).toBeGreaterThanOrEqual(2);
    });

    it('permanently deletes a business and its tenant data', async () => {
      const id = await createBusiness('Delete Co');
      await createLocation(id, 'Main');
      const del = (target: string, confirmation = 'delete this restaurant') =>
        auth(request(http()).delete(`/internal/businesses/${target}`).send({ confirmation }));
      await del(id).expect(200);
      await auth(request(http()).get(`/internal/businesses/${id}`)).expect(404);
      const list = await auth(request(http()).get('/internal/businesses')).expect(200);
      expect(list.body.map((b: { id: string }) => b.id)).not.toContain(id);
    });

    it('requires the exact deletion phrase', async () => {
      const id = await createBusiness('Confirm Co');
      await auth(
        request(http()).delete(`/internal/businesses/${id}`).send({ confirmation: 'delete' }),
      ).expect(400);
      await auth(request(http()).get(`/internal/businesses/${id}`)).expect(200);
      await auth(request(http()).delete(`/internal/businesses/${id}`).send({})).expect(400);
      await auth(request(http()).delete(`/internal/businesses/${id}`)).expect(400);
      await auth(
        request(http())
          .delete(`/internal/businesses/${id}`)
          .send({ confirmation: 'delete this restaurant' }),
      ).expect(200);
    });

    it('404s deleting an unknown business and 400s a malformed id', async () => {
      await auth(
        request(http())
          .delete('/internal/businesses/00000000-0000-4000-8000-000000000000')
          .send({ confirmation: 'delete this restaurant' }),
      ).expect(404);
      await auth(
        request(http())
          .delete('/internal/businesses/not-a-uuid')
          .send({ confirmation: 'delete this restaurant' }),
      ).expect(400);
    });

    it('rejects an unknown business type (400)', async () => {
      const res = await auth(
        request(http()).post('/internal/businesses').send({ name: 'X', businessTypeKey: 'nope' }),
      ).expect(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('enforces unique location code within a business (409)', async () => {
      const id = await createBusiness('Dup Codes');
      await createLocation(id, 'One', 'DUP');
      const res = await auth(
        request(http()).post(`/internal/businesses/${id}/locations`).send({ name: 'Two', code: 'DUP' }),
      ).expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('settings precedence + concurrency', () => {
    it('resolves default -> business -> location and validates + versions writes', async () => {
      const id = await createBusiness('Settings Co');
      const loc = await createLocation(id, 'Loc', 'L1');
      const key = '/internal/businesses/' + id + '/settings/core/time_format';

      // default
      let res = await auth(request(http()).get(key)).expect(200);
      expect(res.body).toMatchObject({ value: '24h', source: 'default' });

      // business scope
      await auth(request(http()).put(key).send({ value: '12h' })).expect(200);
      res = await auth(request(http()).get(key)).expect(200);
      expect(res.body).toMatchObject({ value: '12h', source: 'business', version: 1 });

      // location override wins
      await auth(request(http()).put(`${key}?locationId=${loc}`).send({ value: '24h' })).expect(200);
      res = await auth(request(http()).get(`${key}?locationId=${loc}`)).expect(200);
      expect(res.body).toMatchObject({ value: '24h', source: 'location' });

      // invalid value rejected
      res = await auth(request(http()).put(key).send({ value: '13h' })).expect(400);
      expect(res.body.error.code).toBe('VALIDATION');

      // stale optimistic version rejected
      res = await auth(request(http()).put(key).send({ value: '12h', expectedVersion: 0 })).expect(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
    });
  });

  describe('numbering', () => {
    it('allocates gaplessly and formats with prefix/padding', async () => {
      const id = await createBusiness('Numbering Co');
      await auth(
        request(http())
          .post(`/internal/businesses/${id}/numbering/checkout/configure`)
          .send({ prefix: 'INV-', padding: 4, startAt: 7 }),
      ).expect(201);
      const a = await auth(
        request(http()).post(`/internal/businesses/${id}/numbering/checkout/allocate`),
      ).expect(201);
      const b = await auth(
        request(http()).post(`/internal/businesses/${id}/numbering/checkout/allocate`),
      ).expect(201);
      expect(a.body.formatted).toBe('INV-0007');
      expect(b.body.formatted).toBe('INV-0008');
    });
  });

  describe('TENANT ISOLATION (ADR-002)', () => {
    it('denies cross-business reads, writes, and leaks', async () => {
      const a = await createBusiness('Alpha');
      const b = await createBusiness('Beta', 'cafe');
      const aLoc = await createLocation(a, 'A-Loc', 'AL');

      // read A's location through B's path -> 404
      await auth(request(http()).get(`/internal/businesses/${b}/locations/${aLoc}`)).expect(404);

      // write a setting on A's location through B -> 404 (location not in B)
      await auth(
        request(http())
          .put(`/internal/businesses/${b}/settings/core/time_format?locationId=${aLoc}`)
          .send({ value: '12h' }),
      ).expect(404);

      // B's location list does not contain A's location
      const list = await auth(request(http()).get(`/internal/businesses/${b}/locations`)).expect(200);
      expect(list.body.map((l: { id: string }) => l.id)).not.toContain(aLoc);

      // numbering is per-business: B's fresh series starts at 1, not A's counter
      await auth(request(http()).post(`/internal/businesses/${a}/numbering/sr/allocate`)).expect(201);
      await auth(request(http()).post(`/internal/businesses/${a}/numbering/sr/allocate`)).expect(201);
      const bFirst = await auth(
        request(http()).post(`/internal/businesses/${b}/numbering/sr/allocate`),
      ).expect(201);
      expect(bFirst.body.value).toBe('1');
    });

    it('404s an unknown business and 400s a malformed id', async () => {
      await auth(
        request(http()).get('/internal/businesses/00000000-0000-4000-8000-000000000000/locations'),
      ).expect(404);
      await auth(request(http()).get('/internal/businesses/not-a-uuid/locations')).expect(400);
    });
  });

  describe('concurrency (advisory-lock serialization)', () => {
    it('allocates numbers gaplessly under concurrent requests', async () => {
      const id = await createBusiness('Concurrent Co');
      const N = 15;
      const results = await Promise.all(
        Array.from({ length: N }, () =>
          auth(request(http()).post(`/internal/businesses/${id}/numbering/order/allocate`)),
        ),
      );
      const values = results.map((r) => Number(r.body.value)).sort((a, b) => a - b);
      expect(values).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    });

    it('serializes concurrent audited writes into a gapless, valid chain', async () => {
      const id = await createBusiness('Chain Co');
      const N = 15;
      await Promise.all(
        Array.from({ length: N }, (_, i) =>
          auth(
            request(http())
              .post(`/internal/businesses/${id}/numbering/s${i}/configure`)
              .send({ prefix: `P${i}-` }),
          ),
        ),
      );
      const verify = await auth(
        request(http()).get(`/internal/businesses/${id}/audit/verify`),
      ).expect(200);
      expect(verify.body.valid).toBe(true);
      // business.created + N numbering.configured, all sequenced without gaps
      expect(verify.body.count).toBe(N + 1);
    });
  });

  describe('audit integrity walker', () => {
    it('detects tampering when a stored event is mutated', async () => {
      const id = await createBusiness('Tamper Co');
      await createLocation(id, 'L', 'L');

      // Sanity: chain is valid before tampering.
      let verify = await auth(request(http()).get(`/internal/businesses/${id}/audit/verify`));
      expect(verify.body.valid).toBe(true);

      // Tamper: silently edit a stored event's action (bypassing the service).
      const prisma = app.get(PrismaService);
      const first = await prisma.auditEvent.findFirst({
        where: { businessId: id },
        orderBy: { sequence: 'asc' },
      });
      await prisma.auditEvent.update({
        where: { id: first!.id },
        data: { action: 'business.forged' },
      });

      verify = await auth(request(http()).get(`/internal/businesses/${id}/audit/verify`)).expect(200);
      expect(verify.body.valid).toBe(false);
      expect(verify.body.brokenAtSequence).toBe(Number(first!.sequence));
      expect(verify.body.reason).toMatch(/hash/i);
    });
  });

  describe('settings validation + versioning edges', () => {
    it('supports expectedVersion=0 on first write and increments thereafter', async () => {
      const id = await createBusiness('Version Co');
      const key = `/internal/businesses/${id}/settings/core/locale`;

      // expectedVersion 0 asserts "no row yet" and succeeds
      let res = await auth(request(http()).put(key).send({ value: 'en', expectedVersion: 0 })).expect(200);
      expect(res.body.version).toBe(1);
      // correct expectedVersion advances the counter
      res = await auth(request(http()).put(key).send({ value: 'hi', expectedVersion: 1 })).expect(200);
      expect(res.body.version).toBe(2);
    });

    it('rejects unknown settings and namespaces', async () => {
      const id = await createBusiness('Unknown Co');
      await auth(
        request(http()).put(`/internal/businesses/${id}/settings/core/nope`).send({ value: 'x' }),
      ).expect(400);
      await auth(request(http()).get(`/internal/businesses/${id}/settings/core/nope`)).expect(404);
      await auth(
        request(http()).get(`/internal/businesses/${id}/settings/effective?namespace=ghost`),
      ).expect(404);
    });

    it('rejects unknown body fields (.strict) to catch client typos', async () => {
      const id = await createBusiness('Strict Co');
      await auth(
        request(http())
          .put(`/internal/businesses/${id}/settings/core/locale`)
          .send({ value: 'en', expcetedVersion: 1 }),
      ).expect(400);
    });
  });

  describe('numbering configure guardrails', () => {
    it('rejects changing startAt once a series has allocated', async () => {
      const id = await createBusiness('Start Co');
      await auth(request(http()).post(`/internal/businesses/${id}/numbering/inv/allocate`)).expect(201);
      const res = await auth(
        request(http()).post(`/internal/businesses/${id}/numbering/inv/configure`).send({ startAt: 500 }),
      ).expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });
});
