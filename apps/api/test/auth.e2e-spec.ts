import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

// AUTH_RATE_LIMIT is set high by test/setup-env.ts so this functional suite's
// many logins don't trip the throttler (see auth-ratelimit.e2e-spec.ts).
const PW = 'Passw0rd!23';
// Emails are globally unique — make them unique per run so the suite is
// idempotent against a persistent dev database.
const RUN = Date.now().toString(36);
const email = (name: string): string => `${name}.${RUN}@test.local`;

/** Extract the raw refresh token from a Set-Cookie header (cookie-only now). */
function extractRefresh(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (cookies ?? []).find((c) => c.startsWith('nexus_refresh='));
  if (!cookie) throw new Error('no refresh cookie set');
  return decodeURIComponent(cookie.split(';')[0].split('=')[1]);
}

/**
 * Authentication & Access (Phase 3) integration tests against real PostgreSQL.
 * Covers login/lockout/enumeration, refresh rotation + reuse detection,
 * session revocation, RBAC, business + location isolation, and privilege
 * escalation defenses. Requires DB migrated + seeded (platform admin exists).
 */
describe('Auth & Access (e2e)', () => {
  let app: INestApplication;
  const http = (): string => app.getHttpServer();
  const bearer = (r: request.Test, token: string): request.Test =>
    r.set('authorization', `Bearer ${token}`);

  let platformToken: string;
  let aId: string;
  let aLoc1: string;
  let aLoc2: string;
  let bId: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let locationManagerRoleId: string;

  async function login(email: string, password: string): Promise<request.Response> {
    return request(http()).post('/auth/login').send({ email, password });
  }
  async function loginToken(email: string, password: string): Promise<string> {
    const res = await login(email, password);
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }
  async function platformPost(path: string, body: object): Promise<request.Response> {
    return bearer(request(http()).post(path), platformToken).send(body);
  }
  async function createBusiness(name: string, key = 'restaurant'): Promise<string> {
    const res = await platformPost('/internal/businesses', { name, businessTypeKey: key });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }
  async function createLocation(businessId: string, name: string, code: string): Promise<string> {
    const res = await platformPost(`/internal/businesses/${businessId}/locations`, { name, code });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }
  async function createOwner(businessId: string, email: string): Promise<void> {
    const res = await platformPost(`/internal/businesses/${businessId}/users`, {
      email,
      password: PW,
      displayName: email,
      roleKeys: ['owner'],
    });
    expect(res.status).toBe(201);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const platformEmail = process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local';
    const platformPassword = process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345';
    platformToken = await loginToken(platformEmail, platformPassword);

    aId = await createBusiness('Alpha Auth Co');
    aLoc1 = await createLocation(aId, 'Alpha One', 'A1');
    aLoc2 = await createLocation(aId, 'Alpha Two', 'A2');
    await createOwner(aId, email('ownera'));
    ownerAToken = await loginToken(email('ownera'), PW);

    bId = await createBusiness('Beta Auth Co', 'cafe');
    await createOwner(bId, email('ownerb'));
    ownerBToken = await loginToken(email('ownerb'), PW);

    const roles = await bearer(request(http()).get('/admin/roles'), ownerAToken).expect(200);
    locationManagerRoleId = roles.body.find((r: { key: string }) => r.key === 'location-manager').id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('login', () => {
    it('rejects a wrong password with a generic 401', async () => {
      const res = await login(email('ownera'), 'wrong-password');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('returns the SAME generic 401 for an unknown user (no enumeration)', async () => {
      const res = await login('nobody@nowhere.test', 'whatever');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('me', () => {
    it('returns the profile + roles for an authenticated user', async () => {
      const res = await bearer(request(http()).get('/auth/me'), ownerAToken).expect(200);
      expect(res.body.email).toBe(email('ownera'));
      expect(res.body.realm).toBe('BUSINESS');
      expect(res.body.roles.map((r: { key: string }) => r.key)).toContain('owner');
    });
    it('rejects without a token', async () => {
      await request(http()).get('/auth/me').expect(401);
    });
  });

  describe('sessions: refresh rotation, reuse detection, revocation', () => {
    it('never returns the refresh token in the JSON body (cookie only)', async () => {
      const res = await login(process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local', process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345');
      expect(res.body.refreshToken).toBeUndefined();
      expect(extractRefresh(res)).toBeTruthy();
    });

    it('rotates refresh tokens and revokes the family on reuse', async () => {
      // dedicated user so we don't disturb ownerA's session
      await bearer(request(http()).post(`/admin/users`), ownerAToken)
        .send({ email: email('refreshuser'), password: PW, displayName: 'r', roleKeys: ['owner'] })
        .expect(201);
      const first = await login(email('refreshuser'), PW);
      const r1 = extractRefresh(first);

      const rotated = await request(http()).post('/auth/refresh').send({ refreshToken: r1 }).expect(200);
      const r2 = extractRefresh(rotated);
      expect(r2).not.toBe(r1);

      // Reusing the rotated (consumed) token is theft → 401 + family revoked.
      await request(http()).post('/auth/refresh').send({ refreshToken: r1 }).expect(401);
      await request(http()).post('/auth/refresh').send({ refreshToken: r2 }).expect(401);
    });

    it('concurrent rotation with the same token: exactly one succeeds', async () => {
      await bearer(request(http()).post(`/admin/users`), ownerAToken)
        .send({ email: email('raceuser'), password: PW, displayName: 'race', roleKeys: ['owner'] })
        .expect(201);
      const first = await login(email('raceuser'), PW);
      const r = extractRefresh(first);
      const results = await Promise.all([
        request(http()).post('/auth/refresh').send({ refreshToken: r }),
        request(http()).post('/auth/refresh').send({ refreshToken: r }),
      ]);
      const ok = results.filter((x) => x.status === 200).length;
      expect(ok).toBe(1);
    });

    it('logout revokes the session so the access token is rejected', async () => {
      await bearer(request(http()).post(`/admin/users`), ownerAToken)
        .send({ email: email('logoutuser'), password: PW, displayName: 'l', roleKeys: ['owner'] })
        .expect(201);
      const token = await loginToken(email('logoutuser'), PW);
      await bearer(request(http()).get('/auth/me'), token).expect(200);
      await bearer(request(http()).post('/auth/logout'), token).expect(204);
      await bearer(request(http()).get('/auth/me'), token).expect(401);
    });

    it('logout-all invalidates a live access token (tokenVersion bump)', async () => {
      await bearer(request(http()).post(`/admin/users`), ownerAToken)
        .send({ email: email('logoutall'), password: PW, displayName: 'la', roleKeys: ['owner'] })
        .expect(201);
      const token = await loginToken(email('logoutall'), PW);
      await bearer(request(http()).get('/auth/me'), token).expect(200);
      await bearer(request(http()).post('/auth/logout-all'), token).expect(204);
      await bearer(request(http()).get('/auth/me'), token).expect(401);
    });
  });

  describe('change password', () => {
    const NEW_PW = 'N3w-Passw0rd!45';
    it('needs the current password, signs the user out everywhere, and the new one works', async () => {
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({ email: email('chgpw'), password: PW, displayName: 'cp', roleKeys: ['owner'] })
        .expect(201);
      const token = await loginToken(email('chgpw'), PW);

      await bearer(request(http()).post('/auth/change-password'), token).send({ currentPassword: 'wrong-password', newPassword: NEW_PW }).expect(400);
      await bearer(request(http()).post('/auth/change-password'), token).send({ currentPassword: PW, newPassword: PW }).expect(400);
      await bearer(request(http()).post('/auth/change-password'), token).send({ currentPassword: PW, newPassword: 'short' }).expect(400);

      await bearer(request(http()).post('/auth/change-password'), token).send({ currentPassword: PW, newPassword: NEW_PW }).expect(204);
      await bearer(request(http()).get('/auth/me'), token).expect(401);
      expect((await login(email('chgpw'), PW)).status).toBe(401);
      expect((await login(email('chgpw'), NEW_PW)).status).toBe(200);
    });
    it('requires authentication', async () => {
      await request(http()).post('/auth/change-password').send({ currentPassword: PW, newPassword: NEW_PW }).expect(401);
    });
  });

  describe('temporary password (forced change)', () => {
    it('blocks everything except profile, sign-out and the password change until it is changed', async () => {
      const biz = await createBusiness('Temp Pw Co');
      const em = email('temppw');
      await platformPost(`/internal/businesses/${biz}/provision`, { email: em, displayName: 'T', password: PW, requirePasswordChange: true }).then((r) => expect(r.status).toBe(201));
      const token = await loginToken(em, PW);

      const me = await bearer(request(http()).get('/auth/me'), token).expect(200);
      expect(me.body.mustChangePassword).toBe(true);
      expect(me.body.business).toEqual({ name: 'Temp Pw Co', accentColor: null });
      await bearer(request(http()).get('/admin/users'), token).expect(403);

      await bearer(request(http()).post('/auth/change-password'), token).send({ currentPassword: PW, newPassword: 'Fresh-Passw0rd!9' }).expect(204);
      const after = await loginToken(em, 'Fresh-Passw0rd!9');
      const me2 = await bearer(request(http()).get('/auth/me'), after).expect(200);
      expect(me2.body.mustChangePassword).toBe(false);
      await bearer(request(http()).get('/admin/users'), after).expect(200);
    });

    it('provisioning without the flag keeps the old behaviour', async () => {
      const biz = await createBusiness('No Flag Co');
      const em = email('noflag');
      await platformPost(`/internal/businesses/${biz}/provision`, { email: em, displayName: 'N', password: PW }).then((r) => expect(r.status).toBe(201));
      const token = await loginToken(em, PW);
      expect((await bearer(request(http()).get('/auth/me'), token).expect(200)).body.mustChangePassword).toBe(false);
    });
  });

  describe('RBAC + business isolation', () => {
    let limitedToken: string;

    beforeAll(async () => {
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({
          email: email('viewer'),
          password: PW,
          displayName: 'viewer',
          roleKeys: ['location-manager'],
        })
        .expect(201);
      limitedToken = await loginToken(email('viewer'), PW);
    });

    it('allows a permitted action and denies an unpermitted one (403)', async () => {
      // location-manager has core.user.view but not core.user.create
      await bearer(request(http()).get('/admin/users'), limitedToken).expect(200);
      await bearer(request(http()).post('/admin/users'), limitedToken)
        .send({ email: 'x@alpha.test', password: PW, displayName: 'x' })
        .expect(403);
    });

    it('denies a business user access to the platform realm (403)', async () => {
      await bearer(request(http()).get('/internal/business-types'), ownerAToken).expect(403);
    });

    it('scopes user lists to the caller business (no cross-business leak)', async () => {
      const aUsers = await bearer(request(http()).get('/admin/users'), ownerAToken).expect(200);
      const bUsers = await bearer(request(http()).get('/admin/users'), ownerBToken).expect(200);
      const aEmails = aUsers.body.map((u: { email: string }) => u.email);
      const bEmails = bUsers.body.map((u: { email: string }) => u.email);
      expect(aEmails).toContain(email('ownera'));
      expect(aEmails).not.toContain(email('ownerb'));
      expect(bEmails).toContain(email('ownerb'));
      expect(bEmails).not.toContain(email('ownera'));
    });
  });

  describe('privilege escalation defenses', () => {
    it('blocks granting a platform permission to a business role (403)', async () => {
      await bearer(request(http()).post('/admin/roles'), ownerAToken)
        .send({ key: 'evil', name: 'Evil', permissions: ['platform.business.create'] })
        .expect(403);
    });

    it('blocks granting a permission the creator does not hold (403)', async () => {
      // Give a user a role that can create roles but nothing else sensitive.
      await bearer(request(http()).post('/admin/roles'), ownerAToken)
        .send({ key: 'role-admin', name: 'Role Admin', permissions: ['core.role.view', 'core.role.create'] })
        .expect(201);
      const roles = await bearer(request(http()).get('/admin/roles'), ownerAToken).expect(200);
      const roleAdminId = roles.body.find((r: { key: string }) => r.key === 'role-admin').id;
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({ email: email('roleadmin'), password: PW, displayName: 'ra' })
        .expect(201);
      const users = await bearer(request(http()).get('/admin/users'), ownerAToken).expect(200);
      const raId = users.body.find((u: { email: string }) => u.email === email('roleadmin')).id;
      await bearer(request(http()).post(`/admin/users/${raId}/roles`), ownerAToken)
        .send({ roleId: roleAdminId })
        .expect(204);
      const raToken = await loginToken(email('roleadmin'), PW);

      // role-admin holds core.role.view/create but NOT core.user.deactivate.
      await bearer(request(http()).post('/admin/roles'), raToken)
        .send({ key: 'sneaky', name: 'Sneaky', permissions: ['core.user.deactivate'] })
        .expect(403);
      // Granting a permission it DOES hold succeeds.
      await bearer(request(http()).post('/admin/roles'), raToken)
        .send({ key: 'fine', name: 'Fine', permissions: ['core.role.view'] })
        .expect(201);
    });

    it('blocks ASSIGNING the pre-existing owner (wildcard) role to escalate (403)', async () => {
      // A user with core.role.assign but not wildcard must not be able to
      // assign the all-powerful owner role (the assignment escalation path).
      await bearer(request(http()).post('/admin/roles'), ownerAToken)
        .send({ key: 'assigner', name: 'Assigner', permissions: ['core.user.view', 'core.role.view', 'core.role.assign'] })
        .expect(201);
      const roles = await bearer(request(http()).get('/admin/roles'), ownerAToken).expect(200);
      const assignerRoleId = roles.body.find((r: { key: string }) => r.key === 'assigner').id;
      const ownerRoleId = roles.body.find((r: { key: string }) => r.key === 'owner').id;
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({ email: email('assigner'), password: PW, displayName: 'as' })
        .expect(201);
      const users = await bearer(request(http()).get('/admin/users'), ownerAToken).expect(200);
      const asId = users.body.find((u: { email: string }) => u.email === email('assigner')).id;
      await bearer(request(http()).post(`/admin/users/${asId}/roles`), ownerAToken)
        .send({ roleId: assignerRoleId })
        .expect(204);
      const asToken = await loginToken(email('assigner'), PW);

      // Create a victim/target user to assign owner to.
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({ email: email('target'), password: PW, displayName: 'tg' })
        .expect(201);
      const usersAfter = await bearer(request(http()).get('/admin/users'), ownerAToken).expect(200);
      const targetId = usersAfter.body.find((u: { email: string }) => u.email === email('target')).id;

      // assigner tries to grant owner (wildcard) → 403 (can't grant what you don't hold).
      await bearer(request(http()).post(`/admin/users/${targetId}/roles`), asToken)
        .send({ roleId: ownerRoleId })
        .expect(403);
      // assigner can assign a role whose perms it holds.
      await bearer(request(http()).post(`/admin/users/${targetId}/roles`), asToken)
        .send({ roleId: assignerRoleId })
        .expect(204);
    });

    it('blocks changing your OWN role assignments (separation of duty, 403)', async () => {
      // ownerA holds core.role.assign (wildcard) but self-assignment is blocked.
      const roles = await bearer(request(http()).get('/admin/roles'), ownerAToken).expect(200);
      const anyRoleId = roles.body.find((r: { key: string }) => r.key === 'location-manager').id;
      const me = await bearer(request(http()).get('/auth/me'), ownerAToken).expect(200);
      await bearer(request(http()).post(`/admin/users/${me.body.id}/roles`), ownerAToken)
        .send({ roleId: anyRoleId })
        .expect(403);
    });
  });

  describe('location scope isolation', () => {
    let scopedToken: string;

    beforeAll(async () => {
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({ email: email('lm'), password: PW, displayName: 'lm', roleKeys: ['location-manager'] })
        .expect(201);
      const users = await bearer(request(http()).get('/admin/users'), ownerAToken).expect(200);
      const lmId = users.body.find((u: { email: string }) => u.email === email('lm')).id;
      // Restrict the assignment to location 1 only.
      await bearer(request(http()).post(`/admin/users/${lmId}/roles`), ownerAToken)
        .send({ roleId: locationManagerRoleId, allLocations: false, locationIds: [aLoc1] })
        .expect(204);
      scopedToken = await loginToken(email('lm'), PW);
    });

    it('owner (all locations) can read any location', async () => {
      await bearer(request(http()).get(`/admin/locations/${aLoc1}`), ownerAToken).expect(200);
      await bearer(request(http()).get(`/admin/locations/${aLoc2}`), ownerAToken).expect(200);
    });

    it('a location-scoped user is denied out-of-scope locations (403)', async () => {
      await bearer(request(http()).get(`/admin/locations/${aLoc1}`), scopedToken).expect(200);
      await bearer(request(http()).get(`/admin/locations/${aLoc2}`), scopedToken).expect(403);
    });
  });

  describe('lockout', () => {
    it('locks an account after repeated failures then rejects even correct creds', async () => {
      await bearer(request(http()).post('/admin/users'), ownerAToken)
        .send({ email: email('lockme'), password: PW, displayName: 'lock', roleKeys: ['owner'] })
        .expect(201);
      for (let i = 0; i < 5; i++) {
        const r = await login(email('lockme'), 'wrong');
        expect(r.status).toBe(401);
      }
      const res = await login(email('lockme'), PW);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/locked/i);
    });
  });
});
