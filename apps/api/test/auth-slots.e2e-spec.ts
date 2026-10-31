import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

/**
 * ADR-034: per-tab sessions. One browser profile must be able to hold several users at once, so the refresh
 * cookie is named per slot (`nexus_rt_<slot>`, selected by the X-Nexus-Slot header) next to the device-wide
 * `nexus_refresh`. These tests act as the browser (a tiny cookie jar) and prove: slots never collide, refresh
 * rotation in one slot never touches another, logout is local to its session, there is no fallback from a
 * slot to the device cookie, and dead cookies are pruned.
 */
const PW = 'Passw0rd!23';
const RUN = Date.now().toString(36);
const email = (name: string): string => `${name}.${RUN}@slots.local`;
const SLOT_A = 'aaaa1111bbbb2222cccc3333dddd4444';
const SLOT_B = 'eeee5555ffff6666aaaa7777bbbb8888';
const SLOT_C = 'cccc9999dddd0000eeee1111ffff2222';

/** A minimal browser cookie jar for the /auth path: name -> value, updated from Set-Cookie headers. */
class Jar {
  readonly cookies = new Map<string, string>();
  apply(res: request.Response): string[] {
    const set = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    for (const line of set) {
      const [pair, ...attrs] = line.split(';').map((p) => p.trim());
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const expired = attrs.some((a) => /^expires=thu, 01 jan 1970/i.test(a)) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return set;
  }
  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

describe('Per-tab sessions (ADR-034, e2e)', () => {
  let app: INestApplication;
  const http = (): string => app.getHttpServer();
  let platformToken: string;
  let ownerBToken: string;

  const bearer = (r: request.Test, token: string): request.Test => r.set('authorization', `Bearer ${token}`);
  const post = (path: string, jar: Jar, slot?: string): request.Test => {
    let r = request(http()).post(path);
    if (jar.cookies.size) r = r.set('Cookie', jar.header());
    if (slot) r = r.set('X-Nexus-Slot', slot);
    return r;
  };
  async function loginIn(jar: Jar, user: string, slot?: string): Promise<request.Response> {
    let r = request(http()).post('/auth/login');
    if (jar.cookies.size) r = r.set('Cookie', jar.header());
    if (slot) r = r.set('X-Nexus-Slot', slot);
    const res = await r.send({ email: email(user), password: PW });
    jar.apply(res);
    return res;
  }
  async function refreshIn(jar: Jar, slot?: string): Promise<request.Response> {
    const res = await post('/auth/refresh', jar, slot).send({});
    jar.apply(res);
    return res;
  }
  async function whoAmI(token: string): Promise<string> {
    const res = await bearer(request(http()).get('/auth/me'), token).expect(200);
    return res.body.email as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const platform = await request(http())
      .post('/auth/login')
      .send({ email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local', password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345' })
      .expect(200);
    platformToken = platform.body.accessToken as string;
    const biz = await bearer(request(http()).post('/internal/businesses'), platformToken)
      .send({ name: `Slots Co ${RUN}`, businessTypeKey: 'restaurant' })
      .expect(201);
    for (const name of ['owner', 'cashier', 'waiter']) {
      await bearer(request(http()).post(`/internal/businesses/${biz.body.id}/users`), platformToken)
        .send({ email: email(name), password: PW, displayName: name, roleKeys: ['owner'] })
        .expect(201);
    }
    ownerBToken = (await request(http()).post('/auth/login').send({ email: email('owner'), password: PW }).expect(200)).body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('a slot login sets ONLY its own session cookie (HttpOnly, SameSite=Strict, /auth, no Max-Age), never the device cookie', async () => {
    const jar = new Jar();
    const res = await loginIn(jar, 'owner', SLOT_A);
    expect(res.status).toBe(200);
    const set = (res.headers['set-cookie'] as unknown as string[]).filter((c) => c.startsWith('nexus_'));
    expect(set).toHaveLength(1);
    expect(set[0].startsWith(`nexus_rt_${SLOT_A}=`)).toBe(true);
    expect(set[0]).toMatch(/HttpOnly/i);
    expect(set[0]).toMatch(/SameSite=Strict/i);
    expect(set[0]).toMatch(/Path=\/auth/);
    expect(set[0]).not.toMatch(/Max-Age|Expires/i);
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('a login without a slot still sets the persistent device cookie (single-user experience unchanged)', async () => {
    const jar = new Jar();
    const res = await loginIn(jar, 'owner');
    const set = (res.headers['set-cookie'] as unknown as string[]).filter((c) => c.startsWith('nexus_'));
    expect(set).toHaveLength(1);
    expect(set[0].startsWith('nexus_refresh=')).toBe(true);
    expect(set[0]).toMatch(/Max-Age=\d+/i);
  });

  it('rejects a malformed slot header with 400 and sets no cookie', async () => {
    for (const bad of ['short', 'has space has space has space', 'x'.repeat(65), 'semi;colon;semi;colon;semi;colon']) {
      const res = await request(http()).post('/auth/login').set('X-Nexus-Slot', bad).send({ email: email('owner'), password: PW });
      expect(res.status).toBe(400);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('two tabs, two users: each slot refreshes to ITS user and rotation never crosses over', async () => {
    const jar = new Jar(); // one browser profile
    const a = await loginIn(jar, 'owner', SLOT_A);
    const b = await loginIn(jar, 'cashier', SLOT_B);
    expect(a.body.user.email).toBe(email('owner'));
    expect(b.body.user.email).toBe(email('cashier'));
    expect([...jar.cookies.keys()].sort()).toEqual([`nexus_rt_${SLOT_A}`, `nexus_rt_${SLOT_B}`]);

    // Interleaved reloads (silent refresh) in both tabs, several rounds: always the right identity.
    for (let i = 0; i < 4; i++) {
      const ra = await refreshIn(jar, SLOT_A);
      const rb = await refreshIn(jar, SLOT_B);
      expect(ra.status).toBe(200);
      expect(rb.status).toBe(200);
      expect(await whoAmI(ra.body.accessToken)).toBe(email('owner'));
      expect(await whoAmI(rb.body.accessToken)).toBe(email('cashier'));
    }
  });

  it('a third login in the same profile (device mode) does not disturb the two tab sessions', async () => {
    const jar = new Jar();
    await loginIn(jar, 'owner', SLOT_A);
    await loginIn(jar, 'cashier', SLOT_B);
    const dev = await loginIn(jar, 'waiter'); // device session
    expect(dev.status).toBe(200);
    expect(jar.cookies.has('nexus_refresh')).toBe(true);
    expect(await whoAmI((await refreshIn(jar, SLOT_A)).body.accessToken)).toBe(email('owner'));
    expect(await whoAmI((await refreshIn(jar, SLOT_B)).body.accessToken)).toBe(email('cashier'));
    expect(await whoAmI((await refreshIn(jar)).body.accessToken)).toBe(email('waiter'));
  });

  it('never falls back from a slot to the device cookie (no silent identity swap)', async () => {
    const jar = new Jar();
    await loginIn(jar, 'owner'); // device cookie present
    const res = await refreshIn(jar, SLOT_C); // slot C has no cookie
    expect(res.status).toBe(401);
    // ... and the device session is untouched
    expect((await refreshIn(jar)).status).toBe(200);
  });

  it('logout in one tab revokes only that session and clears only that slot cookie', async () => {
    const jar = new Jar();
    const a = await loginIn(jar, 'owner', SLOT_A);
    const b = await loginIn(jar, 'owner', SLOT_B); // SAME user, second tab
    const dev = await loginIn(jar, 'cashier');
    const tokenA = (await refreshIn(jar, SLOT_A)).body.accessToken as string;
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(dev.status).toBe(200);

    const out = await post('/auth/logout', jar, SLOT_A).set('authorization', `Bearer ${tokenA}`);
    expect(out.status).toBe(204);
    const cleared = jar.apply(out);
    expect(cleared.some((c) => c.startsWith(`nexus_rt_${SLOT_A}=`))).toBe(true);
    expect(cleared.some((c) => c.startsWith(`nexus_rt_${SLOT_B}=`))).toBe(false);
    expect(cleared.some((c) => c.startsWith('nexus_refresh='))).toBe(false);

    // A's access token is dead at once (per-request session check) ...
    await bearer(request(http()).get('/auth/me'), tokenA).expect(401);
    // ... but the same user's other tab and the device session carry on, including through refresh rotation.
    expect((await refreshIn(jar, SLOT_B)).status).toBe(200);
    expect((await refreshIn(jar)).status).toBe(200);
    expect((await refreshIn(jar, SLOT_A)).status).toBe(401);
  });

  it('refresh-token reuse in one slot revokes only that session family, not the other tab', async () => {
    const jar = new Jar();
    await loginIn(jar, 'owner', SLOT_A);
    await loginIn(jar, 'owner', SLOT_B);
    const stolen = jar.cookies.get(`nexus_rt_${SLOT_A}`)!;
    expect((await refreshIn(jar, SLOT_A)).status).toBe(200); // legit rotation consumes `stolen`

    // The thief replays the rotated token (as a body token, the non-browser path): theft detected.
    await request(http()).post('/auth/refresh').send({ refreshToken: stolen }).expect(401);
    expect((await refreshIn(jar, SLOT_A)).status).toBe(401); // slot A's family is revoked
    expect((await refreshIn(jar, SLOT_B)).status).toBe(200); // slot B is a different session: unaffected
  });

  it('serialised refreshes from two tabs of the SAME slot never trip reuse detection', async () => {
    // Tabs that share a slot (and therefore a cookie) refresh one after the other (the web client serialises
    // them with a Web Lock): each sends the freshest cookie, so every call succeeds.
    const jar = new Jar();
    await loginIn(jar, 'owner', SLOT_A);
    for (let i = 0; i < 5; i++) expect((await refreshIn(jar, SLOT_A)).status).toBe(200);
  });

  it('logout-all ends every session of the user, in every slot, but not other users', async () => {
    const jar = new Jar();
    await loginIn(jar, 'waiter', SLOT_A);
    await loginIn(jar, 'waiter', SLOT_B);
    await loginIn(jar, 'cashier', SLOT_C);
    const token = (await refreshIn(jar, SLOT_A)).body.accessToken as string;
    await post('/auth/logout-all', jar, SLOT_A).set('authorization', `Bearer ${token}`).expect(204);
    expect((await refreshIn(jar, SLOT_B)).status).toBe(401);
    expect((await refreshIn(jar, SLOT_C)).status).toBe(200);
  });

  it('prunes dead tab cookies on login but keeps live tab cookies and the device cookie', async () => {
    const jar = new Jar();
    await loginIn(jar, 'owner', SLOT_A); // will stay live
    await loginIn(jar, 'cashier');       // device session, live
    await loginIn(jar, 'waiter', SLOT_C);
    const tokenC = (await refreshIn(jar, SLOT_C)).body.accessToken as string;
    await post('/auth/logout', jar, SLOT_C).set('authorization', `Bearer ${tokenC}`).expect(204);
    // The browser still holds C's old cookie value (simulate the stale copy), plus a garbage slot cookie.
    jar.cookies.set(`nexus_rt_${SLOT_C}`, 'revoked-or-garbage-token-value');
    jar.cookies.set('nexus_rt_ffffffffffffffffffffffffffffffff', 'garbage-never-issued');

    const res = await loginIn(jar, 'owner', SLOT_B);
    expect(res.status).toBe(200);
    const header = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(header).toContain(`nexus_rt_${SLOT_C}=;`);
    expect(header).toContain('nexus_rt_ffffffffffffffffffffffffffffffff=;');
    expect(header).not.toContain(`nexus_rt_${SLOT_A}=;`);
    expect(header).not.toContain('nexus_refresh=;');
    expect([...jar.cookies.keys()].sort()).toEqual(['nexus_refresh', `nexus_rt_${SLOT_A}`, `nexus_rt_${SLOT_B}`].sort());
    // live ones still work
    expect((await refreshIn(jar, SLOT_A)).status).toBe(200);
    expect((await refreshIn(jar)).status).toBe(200);
  });

  it('change-password ends all of that user\'s tabs and leaves other users alone', async () => {
    const jar = new Jar();
    await loginIn(jar, 'owner', SLOT_A);
    await loginIn(jar, 'cashier', SLOT_B);
    const tokenB = (await refreshIn(jar, SLOT_B)).body.accessToken as string;
    // owner (ownerBToken) is a different login; changing the CASHIER's password revokes the cashier tab only.
    await post('/auth/change-password', jar, SLOT_B)
      .set('authorization', `Bearer ${tokenB}`)
      .send({ currentPassword: PW, newPassword: 'N3w-Passw0rd!77' })
      .expect(204);
    expect((await refreshIn(jar, SLOT_B)).status).toBe(401);
    expect((await refreshIn(jar, SLOT_A)).status).toBe(200);
    expect(await whoAmI(ownerBToken)).toBe(email('owner'));
  });
});
