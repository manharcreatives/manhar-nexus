import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * GET /admin/users/directory (Team screen listing) and
 * POST /admin/users/:id/password (administrator password reset).
 */
describe('Team directory + password reset (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let ownerAId: string;
  let lmToken: string;
  let stToken: string;
  let locA1: string;
  let locA2: string;
  let serviceTeamRoleId: string;
  let locationManagerRoleId: string;
  let stUserId: string;
  let bareUserId: string;

  const RUN = Date.now().toString(36);
  const PW = 'Team!Password1';
  const NEW_PW = 'Fresh!Password2';
  const mail = (n: string) => `${n.replace(/\s+/g, '.')}-td-${RUN}@test.local`;
  const http = () => app.getHttpServer();
  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const aGet = (tok: string, path: string) => request(http()).get(path).set('authorization', `Bearer ${tok}`);
  const aPost = (tok: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  const login = (email: string, password = PW) => request(http()).post('/auth/login').send({ email, password });
  const loginToken = async (email: string, password = PW): Promise<string> => {
    const res = await login(email, password);
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };
  const createUser = async (tok: string, name: string, roleKeys: string[] = []): Promise<string> => {
    const res = await aPost(tok, '/admin/users', { email: mail(name), password: PW, displayName: name, roleKeys });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const dir = (tok: string, qs = '') => aGet(tok, `/admin/users/directory${qs}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    platformToken = (
      await login(
        process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
        process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
      )
    ).body.accessToken as string;

    const bizA = (await pPost('/internal/businesses', { name: `TD BizA ${RUN}`, businessTypeKey: 'restaurant' })).body
      .id as string;
    const bizB = (await pPost('/internal/businesses', { name: `TD BizB ${RUN}`, businessTypeKey: 'restaurant' })).body
      .id as string;
    locA1 = (await pPost(`/internal/businesses/${bizA}/locations`, { name: `Andheri ${RUN}` })).body.id as string;
    locA2 = (await pPost(`/internal/businesses/${bizA}/locations`, { name: `Bandra ${RUN}` })).body.id as string;
    for (const [biz, who] of [
      [bizA, 'ownera'],
      [bizB, 'ownerb'],
    ] as const) {
      const r = await pPost(`/internal/businesses/${biz}/users`, {
        email: mail(who),
        password: PW,
        displayName: `Zed ${who}`,
        roleKeys: ['owner'],
      });
      expect(r.status).toBe(201);
    }
    ownerAToken = await loginToken(mail('ownera'));
    ownerBToken = await loginToken(mail('ownerb'));
    ownerAId = (await aGet(ownerAToken, '/auth/me')).body.id as string;

    const roles = (await aGet(ownerAToken, '/admin/roles')).body as { id: string; key: string }[];
    serviceTeamRoleId = roles.find((r) => r.key === 'service-team')!.id;
    locationManagerRoleId = roles.find((r) => r.key === 'location-manager')!.id;

    await createUser(ownerAToken, 'Asha Manager', ['location-manager']);
    lmToken = await loginToken(mail('Asha Manager'));
    stUserId = await createUser(ownerAToken, 'Bilal Server', ['service-team']);
    stToken = await loginToken(mail('Bilal Server'));
    bareUserId = await createUser(ownerAToken, 'Chitra Nobody');

    // Scope Bilal's service-team assignment to two named locations (returned sorted by name).
    const scoped = await aPost(ownerAToken, `/admin/users/${stUserId}/roles`, {
      roleId: serviceTeamRoleId,
      allLocations: false,
      locationIds: [locA2, locA1],
    });
    expect(scoped.status).toBe(204);
    // Suspend Chitra.
    const s = await request(http())
      .patch(`/admin/users/${bareUserId}`)
      .set('authorization', `Bearer ${ownerAToken}`)
      .send({ status: 'SUSPENDED' });
    expect(s.status).toBe(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns { items, total, viewer } sorted by name with role and location names', async () => {
    const res = await dir(ownerAToken);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.map((u: { displayName: string }) => u.displayName)).toEqual([
      'Asha Manager',
      'Bilal Server',
      'Chitra Nobody',
      'Zed ownera',
    ]);
    const bilal = res.body.items[1];
    expect(bilal).toMatchObject({ id: stUserId, email: mail('Bilal Server').toLowerCase(), status: 'ACTIVE' });
    expect(bilal.lastLoginAt).toBeTruthy();
    expect(bilal.lockedUntil).toBeNull();
    expect(bilal.roles).toEqual([
      expect.objectContaining({
        roleId: serviceTeamRoleId,
        key: 'service-team',
        name: 'Service Team',
        isSystem: true,
        allLocations: false,
        locations: [
          { id: locA1, name: `Andheri ${RUN}` },
          { id: locA2, name: `Bandra ${RUN}` },
        ],
      }),
    ]);
    expect(bilal.passwordHash).toBeUndefined();
    expect(bilal.tokenVersion).toBeUndefined();
    const owner = res.body.items[3];
    expect(owner.roles[0]).toMatchObject({ key: 'owner', allLocations: true, locations: [] });
    expect(res.body.viewer).toEqual({ canCreate: true, canEdit: true, canAssignRoles: true, canViewRoles: true });
  });

  it('searches by name or email, case-insensitively', async () => {
    const byName = await dir(ownerAToken, '?q=bilal');
    expect(byName.body.total).toBe(1);
    expect(byName.body.items[0].id).toBe(stUserId);
    const byEmail = await dir(ownerAToken, `?q=${encodeURIComponent('ASHA.MANAGER-TD')}`);
    expect(byEmail.body.total).toBe(1);
    expect((await dir(ownerAToken, '?q=nobody-at-all')).body).toMatchObject({ items: [], total: 0 });
  });

  it('filters by status and by role', async () => {
    const suspended = await dir(ownerAToken, '?status=SUSPENDED');
    expect(suspended.body.total).toBe(1);
    expect(suspended.body.items[0].id).toBe(bareUserId);
    const lms = await dir(ownerAToken, `?roleId=${locationManagerRoleId}`);
    expect(lms.body.items.map((u: { displayName: string }) => u.displayName)).toEqual(['Asha Manager']);
    expect((await dir(ownerAToken, '?status=NOPE')).status).toBe(400);
    expect((await dir(ownerAToken, '?roleId=not-a-uuid')).status).toBe(400);
  });

  it('paginates with bounded take and a full total', async () => {
    const p1 = await dir(ownerAToken, '?take=3&skip=0');
    expect(p1.body.items).toHaveLength(3);
    expect(p1.body.total).toBe(4);
    const p2 = await dir(ownerAToken, '?take=3&skip=3');
    expect(p2.body.items).toHaveLength(1);
    expect((await dir(ownerAToken, '?take=101')).status).toBe(400);
    expect((await dir(ownerAToken, '?take=0')).status).toBe(400);
    expect((await dir(ownerAToken, '?skip=-1')).status).toBe(400);
  });

  it('is tenant isolated', async () => {
    const res = await dir(ownerBToken);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].displayName).toBe('Zed ownerb');
    const other = await dir(ownerBToken, `?roleId=${locationManagerRoleId}`);
    expect(other.body.total).toBe(0);
  });

  it('reports a read-only viewer for a location manager, and 403 without core.user.view', async () => {
    const res = await dir(lmToken);
    expect(res.status).toBe(200);
    expect(res.body.viewer).toEqual({ canCreate: false, canEdit: false, canAssignRoles: false, canViewRoles: false });
    expect((await dir(stToken)).status).toBe(403);
    expect((await request(http()).get('/admin/users/directory')).status).toBe(401);
  });

  it('shows an active lockout and a password reset clears it, revoking sessions', async () => {
    for (let i = 0; i < 5; i++) await login(mail('Bilal Server'), 'wrong-password');
    const locked = await dir(ownerAToken, '?q=bilal');
    expect(locked.body.items[0].lockedUntil).toBeTruthy();

    const reset = await aPost(ownerAToken, `/admin/users/${stUserId}/password`, { password: NEW_PW });
    expect(reset.status).toBe(204);
    // Old live access token is dead; old password no longer works; new one does.
    expect((await aGet(stToken, '/auth/me')).status).toBe(401);
    expect((await login(mail('Bilal Server'), PW)).status).toBe(401);
    expect((await login(mail('Bilal Server'), NEW_PW)).status).toBe(200);
    const after = await dir(ownerAToken, '?q=bilal');
    expect(after.body.items[0].lockedUntil).toBeNull();
  });

  it('validates the new password and blocks resetting your own', async () => {
    expect((await aPost(ownerAToken, `/admin/users/${stUserId}/password`, { password: 'short' })).status).toBe(400);
    expect(
      (await aPost(ownerAToken, `/admin/users/${stUserId}/password`, { password: NEW_PW, extra: 1 })).status,
    ).toBe(400);
    expect((await aPost(ownerAToken, `/admin/users/${ownerAId}/password`, { password: NEW_PW })).status).toBe(403);
  });

  it('escalation firewall: cannot reset the password of someone more powerful', async () => {
    const role = await aPost(ownerAToken, '/admin/roles', {
      key: `pw-reset-${RUN}`,
      name: 'Password Helper',
      permissions: ['core.user.view', 'core.user.edit'],
    });
    expect(role.status).toBe(201);
    const helperId = await createUser(ownerAToken, 'Dev Helper');
    expect((await aPost(ownerAToken, `/admin/users/${helperId}/roles`, { roleId: role.body.id })).status).toBe(204);
    const helperToken = await loginToken(mail('Dev Helper'));

    // Owner holds the wildcard; service-team holds restaurant permissions the helper lacks.
    expect((await aPost(helperToken, `/admin/users/${ownerAId}/password`, { password: NEW_PW })).status).toBe(403);
    expect((await aPost(helperToken, `/admin/users/${stUserId}/password`, { password: NEW_PW })).status).toBe(403);
    // A user with no roles is within the helper's power.
    expect((await aPost(helperToken, `/admin/users/${bareUserId}/password`, { password: NEW_PW })).status).toBe(204);
  });

  it('is tenant isolated for password reset (404 for another business)', async () => {
    expect((await aPost(ownerBToken, `/admin/users/${stUserId}/password`, { password: NEW_PW })).status).toBe(404);
  });

  it('denies password reset without core.user.edit (403)', async () => {
    expect((await aPost(lmToken, `/admin/users/${stUserId}/password`, { password: NEW_PW })).status).toBe(403);
  });
});
