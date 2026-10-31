import { bootstrap, relaxLimits, uuid, type Fixture } from './guestmenu-harness';

// Everything relaxed except what each test below exercises (read per request, so setting it here is enough).
relaxLimits();
process.env.GUESTMENU_LIMIT_MENU_TOKEN = '4';
process.env.GUESTMENU_LIMIT_ORDER_GUEST = '3';
process.env.GUESTMENU_LIMIT_WAITER_GUEST = '2';
process.env.GUESTMENU_LIMIT_PAY_GUEST = '2';
process.env.GUESTMENU_LIMIT_GUEST_CREATE_TOKEN = '3';
process.env.GUESTMENU_LIMIT_BAD_TOKEN_IP = '5';
jest.setTimeout(240_000);

/** QR digital menu: abuse protection of the public endpoints (ADR-035). */
describe('QR digital menu rate limits (e2e)', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await bootstrap('gl');
  });
  afterAll(async () => {
    await f.close();
  });

  it('limits menu reads per table token and answers 429 with Retry-After and a stable error code', async () => {
    const t = await f.table('LM', { open: false });
    const qr = await f.qrToken(t.tableId);
    for (let i = 0; i < 4; i++) expect((await f.pub.get(qr)).status).toBe(200);
    const limited = await f.pub.get(qr);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
    // another table is unaffected (the limit is per token, not global)
    const other = await f.table('LM2', { open: false });
    expect((await f.pub.get(await f.qrToken(other.tableId))).status).toBe(200);
  });

  it('limits issuing guest tokens per table', async () => {
    const t = await f.table('LG');
    const qr = await f.qrToken(t.tableId);
    for (let i = 0; i < 3; i++) expect((await f.pub.post(qr, '/guest', {})).status).toBe(201);
    const limited = await f.pub.post(qr, '/guest', {});
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();
  });

  it('limits orders per guest device', async () => {
    const t = await f.table('LO');
    const qr = await f.qrToken(t.tableId);
    const g = await f.guest(qr);
    const g2 = await f.guest(qr);
    for (let i = 0; i < 3; i++) expect((await f.order(qr, g, [{ itemId: f.ids.tea, qty: 1 }])).status).toBe(201);
    const limited = await f.order(qr, g, [{ itemId: f.ids.tea, qty: 1 }]);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeTruthy();
    // a replay of an earlier request is also counted (a retry storm must not hammer the database)
    expect((await f.order(qr, g, [{ itemId: f.ids.tea, qty: 1 }], { key: uuid() })).status).toBe(429);
    // the other device is not punished for it
    expect((await f.order(qr, g2, [{ itemId: f.ids.tea, qty: 1 }])).status).toBe(201);
  });

  it('limits waiter calls and pay intents per guest device', async () => {
    const t = await f.table('LW');
    const qr = await f.qrToken(t.tableId);
    const g = await f.guest(qr);
    expect((await f.pub.post(qr, '/waiter', { reason: 'call' }, { 'x-guest-token': g })).status).toBe(202);
    expect((await f.pub.post(qr, '/waiter', { reason: 'water' }, { 'x-guest-token': g })).status).toBe(202);
    expect((await f.pub.post(qr, '/waiter', { reason: 'bill' }, { 'x-guest-token': g })).status).toBe(429);
    for (let i = 0; i < 2; i++) expect((await f.pub.post(qr, '/pay-intent', { method: 'upi' }, { 'x-guest-token': g })).status).toBe(409);
    expect((await f.pub.post(qr, '/pay-intent', { method: 'upi' }, { 'x-guest-token': g })).status).toBe(429);
  });

  it('throttles an address that keeps trying invalid links (anti-enumeration), for every public endpoint', async () => {
    const t = await f.table('LB', { open: false });
    const good = await f.qrToken(t.tableId);
    for (let i = 0; i < 5; i++) {
      const miss = await f.pub.get(`${'a'.repeat(31)}${i}`);
      expect(miss.status).toBe(404);
    }
    const blocked = await f.pub.get(`${'b'.repeat(32)}`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.details.reason).toBe('BAD_TOKEN');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // even a valid link from this address waits (the scanner may be walking the token space)
    expect((await f.pub.get(good)).status).toBe(429);
    // staff endpoints are unaffected
    expect((await f.get(f.ownerToken, '/admin/qr/tables')).status).toBe(200);
  });
});
