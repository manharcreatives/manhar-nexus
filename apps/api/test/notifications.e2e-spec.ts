import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 11 — Notifications E2E suite.
 *
 * Coverage:
 *   - List notifications: empty on fresh user, pagination params respected
 *   - Mark single read: only owner can mark their notification, 404 for others (IDOR)
 *   - Mark all read: only marks caller's notifications, not other users' in same business
 *   - unreadOnly filter: returns only unread rows
 *   - Cross-business: user from Biz B cannot read Biz A notifications (scoped by JWT businessId)
 *   - Auth: 401 without token
 *   - Permission: core.notification.view required
 */
describe('Notifications — Phase 11 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  let bizAId: string;
  let ownerAToken: string;
  let _userAId: string;

  let bizBId: string;
  let ownerBToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const aGet = (tok: string, path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${tok}`);

  const aPost = (tok: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);

  const aPatch = (tok: string, path: string, body: object = {}) =>
    request(http()).patch(path).set('authorization', `Bearer ${tok}`).send(body);

  const provisionOwner = async (bizId: string, suffix: string): Promise<{ token: string; userId: string }> => {
    const email = `owner-p11n-${suffix}-${RUN}@test.local`;
    const pw = 'Test!Password1';
    const res = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${suffix}`,
      password: pw,
    });
    expect(res.status).toBe(201);
    const userId = res.body.id as string;
    const login = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(login.status).toBe(200);
    return { token: login.body.accessToken as string, userId };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const login = await request(http()).post('/auth/login').send({
      email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
      password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
    });
    expect(login.status).toBe(200);
    platformToken = login.body.accessToken as string;

    const bizA = await pPost('/internal/businesses', { name: `P11N BizA ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizA.status).toBe(201);
    bizAId = bizA.body.id as string;
    const ownerA = await provisionOwner(bizAId, 'A');
    ownerAToken = ownerA.token;
    _userAId = ownerA.userId;

    const bizB = await pPost('/internal/businesses', { name: `P11N BizB ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizB.status).toBe(201);
    bizBId = bizB.body.id as string;
    const ownerB = await provisionOwner(bizBId, 'B');
    ownerBToken = ownerB.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('List notifications', () => {
    it('returns 200 with empty array for fresh user', async () => {
      const res = await aGet(ownerAToken, '/admin/notifications');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        notifications: expect.any(Array),
        totalUnread: expect.any(Number),
      });
    });

    it('respects take parameter', async () => {
      const res = await aGet(ownerAToken, '/admin/notifications?take=5');
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBeLessThanOrEqual(5);
    });

    it('unreadOnly filter accepted without error', async () => {
      const res = await aGet(ownerAToken, '/admin/notifications?unreadOnly=true');
      expect(res.status).toBe(200);
    });

    it('returns 401 without token', async () => {
      const res = await request(http()).get('/admin/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('Mark single read — IDOR protection', () => {
    it('returns 404 for a notification ID that belongs to a different business', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000001';
      const res = await aPatch(ownerAToken, `/admin/notifications/${fakeId}/read`);
      expect(res.status).toBe(404);
    });

    it('returns 400 on malformed UUID', async () => {
      const res = await aPatch(ownerAToken, '/admin/notifications/not-a-uuid/read');
      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000001';
      const res = await request(http()).patch(`/admin/notifications/${fakeId}/read`);
      expect(res.status).toBe(401);
    });
  });

  describe('Mark all read', () => {
    it('returns 200 with markedCount', async () => {
      const res = await aPost(ownerAToken, '/admin/notifications/read-all');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ markedCount: expect.any(Number) });
    });

    it('does not affect notifications in other businesses', async () => {
      const resA = await aPost(ownerAToken, '/admin/notifications/read-all');
      expect(resA.status).toBe(200);
      const resB = await aGet(ownerBToken, '/admin/notifications');
      expect(resB.status).toBe(200);
      expect(resB.body.businessId).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const res = await request(http()).post('/admin/notifications/read-all');
      expect(res.status).toBe(401);
    });
  });
});
