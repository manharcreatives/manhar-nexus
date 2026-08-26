import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 10 — Printing & Hardware E2E suite.
 *
 * Coverage:
 *   PrintAgent: CRUD, secret rotation, delete blocked when printers attached
 *   PrinterProfile: CRUD, location+business isolation
 *   PrintTemplate: CRUD, default resolution (location-scoped > business-scoped > hardcoded)
 *   PrintJob (admin): enqueue MANUAL, idempotency, list/filter, reprint, cancel
 *   PrintJob (agent): heartbeat, job claim (QUEUED→SENT), PRINTED, FAILED+retry, OFFLINE
 *   State machine: retry resets to QUEUED until maxRetries exceeded → FAILED
 *   Idempotency: duplicate enqueueKey returns existing job, not a duplicate
 *   Security: cross-business isolation (printer, template, job)
 *   Security: agent cannot modify jobs belonging to another agent's printer
 *   Module gating: 403 MODULE_DISABLED when printing not active
 *
 * Hard invariant: API 2xx NEVER means "printed successfully" (ADR-007 / ADR-025).
 * Only agent-reported PRINTED status is authoritative.
 */
describe('Printing & Hardware — Phase 10 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  // Business A — primary test tenant
  let bizAId: string;
  let ownerAToken: string;
  let locAId: string;

  // Business B — cross-tenant isolation tests
  let bizBId: string;
  let ownerBToken: string;
  let locBId: string;

  // Phase 10 entities (Business A)
  let agentId: string;
  let agentSecret: string;
  let printerId: string;
  let templateId: string;

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

  const aDelete = (tok: string, path: string) =>
    request(http()).delete(path).set('authorization', `Bearer ${tok}`);

  // Agent-facing requests — authenticate with bearer secret, not JWT.
  const agentGet = (secret: string, path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${secret}`);

  const agentPost = (secret: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${secret}`).send(body);

  const freshKey = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-p10-${suffix}-${RUN}@test.local`;
    const pw = 'Test!Password1';
    const provRes = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${suffix}`,
      password: pw,
    });
    expect(provRes.status).toBe(201);
    const loginRes = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(loginRes.status).toBe(200);
    return loginRes.body.accessToken as string;
  };

  const mkLoc = async (bizId: string, suffix = ''): Promise<string> => {
    const res = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: `LocP10${suffix} ${RUN}`.trim(),
      timezone: 'Asia/Kolkata',
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  const activateModule = async (bizId: string, moduleKey: string): Promise<void> => {
    const activateRes = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`);
    if (activateRes.status !== 201 && activateRes.status !== 409) {
      throw new Error(`activate ${moduleKey} failed: ${activateRes.status} ${JSON.stringify(activateRes.body)}`);
    }
    const setupRes = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`);
    if (setupRes.status !== 200 && setupRes.status !== 201) {
      throw new Error(`complete-setup ${moduleKey} failed: ${setupRes.status} ${JSON.stringify(setupRes.body)}`);
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const loginRes = await request(http()).post('/auth/login').send({
      email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
      password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
    });
    expect(loginRes.status).toBe(200);
    platformToken = loginRes.body.accessToken as string;

    // ── Business A setup ─────────────────────────────────────────────────────────
    const bizARes = await pPost('/internal/businesses', { name: `P10 BizA ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizARes.status).toBe(201);
    bizAId = bizARes.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    locAId = await mkLoc(bizAId, 'A');
    // Full dependency chain: restaurant → catalog → checkout → printing
    await activateModule(bizAId, 'restaurant');
    await activateModule(bizAId, 'catalog');
    await activateModule(bizAId, 'checkout');
    await activateModule(bizAId, 'printing');

    // ── Business B setup ─────────────────────────────────────────────────────────
    const bizBRes = await pPost('/internal/businesses', { name: `P10 BizB ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizBRes.status).toBe(201);
    bizBId = bizBRes.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
    locBId = await mkLoc(bizBId, 'B');
    await activateModule(bizBId, 'restaurant');
    await activateModule(bizBId, 'catalog');
    await activateModule(bizBId, 'checkout');
    await activateModule(bizBId, 'printing');
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Print Agent — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PrintAgent — CRUD', () => {
    it('creates a print agent and returns the plaintext secret once', async () => {
      const res = await aPost(ownerAToken, '/admin/printing/agents', {
        locationId: locAId,
        name: `Agent P10 ${RUN}`,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(`Agent P10 ${RUN}`);
      expect(res.body.locationId).toBe(locAId);
      expect(res.body.businessId).toBe(bizAId);
      // secret is a 64-char hex string (32 random bytes)
      expect(typeof res.body.secret).toBe('string');
      expect(res.body.secret).toMatch(/^[0-9a-f]{64}$/);
      // secretHash must NOT be exposed in the response
      expect(res.body.secretHash).toBeUndefined();
      agentId = res.body.id as string;
      agentSecret = res.body.secret as string;
    });

    it('lists agents for the business', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/agents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((a: { id: string }) => a.id === agentId)).toBe(true);
    });

    it('lists agents filtered by locationId', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/agents?locationId=${locAId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((a: { locationId: string }) => a.locationId === locAId)).toBe(true);
    });

    it('fetches a single agent by id', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/agents/${agentId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(agentId);
      // secret must not appear on get
      expect(res.body.secret).toBeUndefined();
      expect(res.body.secretHash).toBeUndefined();
    });

    it('updates agent name', async () => {
      const res = await aPatch(ownerAToken, `/admin/printing/agents/${agentId}`, {
        name: `Agent P10 Updated ${RUN}`,
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(`Agent P10 Updated ${RUN}`);
    });

    it('rotates agent secret and returns new secret', async () => {
      const res = await aPost(ownerAToken, `/admin/printing/agents/${agentId}/rotate-secret`);
      expect(res.status).toBe(201);
      expect(typeof res.body.secret).toBe('string');
      expect(res.body.secret).toMatch(/^[0-9a-f]{64}$/);
      // New secret must differ from the original
      expect(res.body.secret).not.toBe(agentSecret);
      agentSecret = res.body.secret as string;
    });

    it('returns 404 for unknown agent id', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/agents/${freshKey()}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for cross-business agent access', async () => {
      const res = await aGet(ownerBToken, `/admin/printing/agents/${agentId}`);
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Printer Profile — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PrinterProfile — CRUD', () => {
    it('creates a printer profile attached to the agent', async () => {
      const res = await aPost(ownerAToken, '/admin/printing/printers', {
        locationId: locAId,
        agentId,
        name: `Receipt Printer ${RUN}`,
        purpose: 'RECEIPT',
        connectionType: 'NETWORK_ESC_POS',
        deviceConfig: { host: '192.168.1.100', port: 9100 },
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.agentId).toBe(agentId);
      expect(res.body.purpose).toBe('RECEIPT');
      expect(res.body.businessId).toBe(bizAId);
      printerId = res.body.id as string;
    });

    it('lists printers for the business', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/printers');
      expect(res.status).toBe(200);
      expect(res.body.some((p: { id: string }) => p.id === printerId)).toBe(true);
    });

    it('filters printers by purpose', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/printers?purpose=RECEIPT');
      expect(res.status).toBe(200);
      expect(res.body.every((p: { purpose: string }) => p.purpose === 'RECEIPT')).toBe(true);
    });

    it('fetches printer by id', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/printers/${printerId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(printerId);
    });

    it('updates printer name', async () => {
      const res = await aPatch(ownerAToken, `/admin/printing/printers/${printerId}`, {
        name: `Receipt Printer Updated ${RUN}`,
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(`Receipt Printer Updated ${RUN}`);
    });

    it('returns 404 for cross-business printer access', async () => {
      const res = await aGet(ownerBToken, `/admin/printing/printers/${printerId}`);
      expect(res.status).toBe(404);
    });

    it('blocks agent deletion when printers are still attached', async () => {
      const res = await aDelete(ownerAToken, `/admin/printing/agents/${agentId}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Print Template — CRUD + default resolution
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PrintTemplate — CRUD', () => {
    it('creates a business-scoped default receipt template', async () => {
      const res = await aPost(ownerAToken, '/admin/printing/templates', {
        purpose: 'RECEIPT',
        name: `Receipt Tmpl ${RUN}`,
        isDefault: true,
        config: {
          showBusinessName: true,
          showTaxBreakdown: true,
          footerText: 'Thank you for dining with us!',
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.isDefault).toBe(true);
      expect(res.body.purpose).toBe('RECEIPT');
      templateId = res.body.id as string;
    });

    it('creating a second default un-sets the first', async () => {
      const res2 = await aPost(ownerAToken, '/admin/printing/templates', {
        purpose: 'RECEIPT',
        name: `Receipt Tmpl2 ${RUN}`,
        isDefault: true,
        config: { showBusinessName: false },
      });
      expect(res2.status).toBe(201);
      expect(res2.body.isDefault).toBe(true);

      // First template should no longer be default
      const check = await aGet(ownerAToken, `/admin/printing/templates/${templateId}`);
      expect(check.status).toBe(200);
      expect(check.body.isDefault).toBe(false);

      // Clean up second template so the original remains the only one
      const del = await aDelete(ownerAToken, `/admin/printing/templates/${res2.body.id as string}`);
      expect(del.status).toBe(200);

      // Restore templateId as default
      const restore = await aPatch(ownerAToken, `/admin/printing/templates/${templateId}`, { isDefault: true });
      expect(restore.status).toBe(200);
      expect(restore.body.isDefault).toBe(true);
    });

    it('creates a KOT template', async () => {
      const res = await aPost(ownerAToken, '/admin/printing/templates', {
        purpose: 'KOT',
        name: `KOT Tmpl ${RUN}`,
        isDefault: true,
        config: { showTableCode: true, showKitchenNotes: true },
      });
      expect(res.status).toBe(201);
      expect(res.body.purpose).toBe('KOT');
    });

    it('lists templates for the business', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/templates');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((t: { id: string }) => t.id === templateId)).toBe(true);
    });

    it('fetches template by id', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/templates/${templateId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(templateId);
    });

    it('returns 404 for cross-business template access', async () => {
      const res = await aGet(ownerBToken, `/admin/printing/templates/${templateId}`);
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent auth — heartbeat
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Agent authentication — heartbeat', () => {
    it('responds 201 to valid agent bearer secret', async () => {
      const res = await agentPost(agentSecret, '/agent/print/heartbeat');
      expect(res.status).toBe(201);
      expect(res.body.agentId).toBe(agentId);
      expect(res.body.lastSeenAt).toBeDefined();
    });

    it('returns 401 for invalid/missing bearer secret', async () => {
      const res = await request(http()).post('/agent/print/heartbeat').send({});
      expect(res.status).toBe(401);
    });

    it('returns 401 for wrong bearer secret', async () => {
      const res = await agentPost('deadbeef'.repeat(8), '/agent/print/heartbeat');
      expect(res.status).toBe(401);
    });

    it('does not accept a user JWT on agent endpoints', async () => {
      // User JWTs should not be treated as agent secrets
      const res = await request(http())
        .post('/agent/print/heartbeat')
        .set('authorization', `Bearer ${ownerAToken}`)
        .send({});
      // JWT is not a valid 64-hex agent secret → 401
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Print Job — enqueue, idempotency, list, cancel
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PrintJob — enqueue (MANUAL)', () => {
    let jobId: string;
    let enqueueKey: string;

    beforeAll(() => {
      enqueueKey = freshKey();
    });

    it('enqueues a MANUAL job and returns QUEUED status', async () => {
      const res = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: enqueueKey,
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'manual-test-source',
        locationId: locAId,
        printerId,
        payload: { note: 'Test receipt' },
        maxRetries: 2,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('QUEUED');
      expect(res.body.purpose).toBe('RECEIPT');
      expect(res.body.businessId).toBe(bizAId);
      expect(res.body.locationId).toBe(locAId);
      expect(res.body.printerId).toBe(printerId);
      jobId = res.body.id as string;
    });

    it('idempotency: duplicate enqueue key returns same job', async () => {
      const res = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: enqueueKey,
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'manual-test-source',
        locationId: locAId,
        payload: {},
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(jobId);
    });

    it('lists jobs for the business', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/jobs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((j: { id: string }) => j.id === jobId)).toBe(true);
    });

    it('filters jobs by status', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/jobs?status=QUEUED');
      expect(res.status).toBe(200);
      expect(res.body.every((j: { status: string }) => j.status === 'QUEUED')).toBe(true);
    });

    it('fetches job by id', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/jobs/${jobId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(jobId);
    });

    it('returns 404 for cross-business job access', async () => {
      const res = await aGet(ownerBToken, `/admin/printing/jobs/${jobId}`);
      expect(res.status).toBe(404);
    });

    it('cancels a QUEUED job', async () => {
      // Create a separate job to cancel (so we preserve the main flow job)
      const cancelKey = freshKey();
      const createRes = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: cancelKey,
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'cancel-test',
        locationId: locAId,
        payload: {},
      });
      expect(createRes.status).toBe(201);
      const cancelId = createRes.body.id as string;

      const res = await aPost(ownerAToken, `/admin/printing/jobs/${cancelId}/cancel`, {
        reason: 'Test cancellation',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('cannot cancel a non-QUEUED job', async () => {
      // We'll use the main jobId which is still QUEUED at this point;
      // first transition it to SENT via the agent, then try to cancel
      const claimRes = await agentGet(agentSecret, '/agent/print/jobs');
      expect(claimRes.status).toBe(200);
      // After agent claims it becomes SENT — try to cancel
      const res = await aPost(ownerAToken, `/admin/printing/jobs/${jobId}/cancel`, {});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent — job lifecycle: QUEUED → SENT → PRINTED
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Agent job lifecycle — happy path', () => {
    let jobId: string;

    beforeAll(async () => {
      const res = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: freshKey(),
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'lifecycle-test',
        locationId: locAId,
        printerId,
        payload: { content: 'lifecycle test' },
        maxRetries: 3,
      });
      expect(res.status).toBe(201);
      jobId = res.body.id as string;
    });

    it('agent claims QUEUED job → transitions to SENT', async () => {
      const res = await agentGet(agentSecret, '/agent/print/jobs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const claimed = (res.body as Array<{ id: string; status: string }>).find((j) => j.id === jobId);
      expect(claimed).toBeDefined();
      expect(claimed?.status).toBe('SENT');
    });

    it('admin can see job is now SENT', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/jobs/${jobId}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SENT');
      expect(res.body.sentAt).toBeDefined();
    });

    it('agent marks job PRINTED → terminal state', async () => {
      const res = await agentPost(agentSecret, `/agent/print/jobs/${jobId}/printed`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PRINTED');
      expect(res.body.printedAt).toBeDefined();
    });

    it('admin confirms PRINTED state and printedAt timestamp', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/jobs/${jobId}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PRINTED');
      expect(res.body.printedAt).toBeDefined();
    });

    it('agent cannot mark an already-PRINTED job as PRINTED again', async () => {
      const res = await agentPost(agentSecret, `/agent/print/jobs/${jobId}/printed`);
      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent — retry logic: SENT → FAILED → QUEUED (retry) → FAILED (exhausted)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Agent job lifecycle — retry then exhaust', () => {
    let jobId: string;

    beforeAll(async () => {
      // maxRetries=2 means: 2 retries allowed (retryCount can reach 2 before becoming FAILED)
      const res = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: freshKey(),
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'retry-test',
        locationId: locAId,
        printerId,
        payload: {},
        maxRetries: 2,
      });
      expect(res.status).toBe(201);
      jobId = res.body.id as string;
    });

    it('agent claims job (QUEUED → SENT)', async () => {
      const res = await agentGet(agentSecret, '/agent/print/jobs');
      expect(res.status).toBe(200);
      const job = (res.body as Array<{ id: string; status: string }>).find((j) => j.id === jobId);
      expect(job?.status).toBe('SENT');
    });

    it('first failure: retryCount < maxRetries → resets to QUEUED', async () => {
      const res = await agentPost(agentSecret, `/agent/print/jobs/${jobId}/failed`, {
        reason: 'Paper jam',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('QUEUED');
      expect(res.body.retryCount).toBe(1);
    });

    it('agent re-claims retried job (QUEUED → SENT)', async () => {
      const res = await agentGet(agentSecret, '/agent/print/jobs');
      expect(res.status).toBe(200);
      const job = (res.body as Array<{ id: string; status: string }>).find((j) => j.id === jobId);
      expect(job?.status).toBe('SENT');
    });

    it('second failure: retryCount >= maxRetries → terminal FAILED', async () => {
      const res = await agentPost(agentSecret, `/agent/print/jobs/${jobId}/failed`, {
        reason: 'Printer disconnected',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('FAILED');
      expect(res.body.retryCount).toBe(2);
      expect(res.body.failedAt).toBeDefined();
      expect(res.body.failureReason).toBe('Printer disconnected');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent — OFFLINE transition
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Agent job lifecycle — offline', () => {
    let jobId: string;

    beforeAll(async () => {
      const res = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: freshKey(),
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'offline-test',
        locationId: locAId,
        printerId,
        payload: {},
        maxRetries: 3,
      });
      expect(res.status).toBe(201);
      jobId = res.body.id as string;
    });

    it('agent claims job', async () => {
      const res = await agentGet(agentSecret, '/agent/print/jobs');
      expect(res.status).toBe(200);
      const job = (res.body as Array<{ id: string }>).find((j) => j.id === jobId);
      expect(job).toBeDefined();
    });

    it('agent marks printer offline → OFFLINE status, sentAt cleared for retry', async () => {
      const res = await agentPost(agentSecret, `/agent/print/jobs/${jobId}/offline`, {
        reason: 'Printer unreachable',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OFFLINE');
      // sentAt must be null so the job can be re-claimed
      expect(res.body.sentAt).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PrintJob — reprint creates new job with parentJobId
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PrintJob — reprint', () => {
    let originalJobId: string;

    beforeAll(async () => {
      // Create and complete a job so we can reprint it
      const enqueueRes = await aPost(ownerAToken, '/admin/printing/jobs', {
        idempotencyKey: freshKey(),
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'reprint-source',
        locationId: locAId,
        printerId,
        payload: { content: 'original print' },
        maxRetries: 3,
      });
      expect(enqueueRes.status).toBe(201);
      originalJobId = enqueueRes.body.id as string;

      // Agent claims it
      await agentGet(agentSecret, '/agent/print/jobs');

      // Agent marks it printed
      await agentPost(agentSecret, `/agent/print/jobs/${originalJobId}/printed`);
    });

    it('creates a reprint job with parentJobId pointing to original', async () => {
      const reprintKey = freshKey();
      const res = await aPost(ownerAToken, `/admin/printing/jobs/${originalJobId}/reprint`, {
        idempotencyKey: reprintKey,
        reason: 'Customer request',
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.id).not.toBe(originalJobId);
      expect(res.body.parentJobId).toBe(originalJobId);
      expect(res.body.status).toBe('QUEUED');
    });

    it('reprint idempotency: same key returns same reprint job', async () => {
      const reprintKey = freshKey();
      const r1 = await aPost(ownerAToken, `/admin/printing/jobs/${originalJobId}/reprint`, {
        idempotencyKey: reprintKey,
        reason: 'Test idempotency',
      });
      const r2 = await aPost(ownerAToken, `/admin/printing/jobs/${originalJobId}/reprint`, {
        idempotencyKey: reprintKey,
        reason: 'Test idempotency',
      });
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r1.body.id).toBe(r2.body.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Security: cross-business isolation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Cross-business isolation', () => {
    let bizBAgentId: string;
    let bizBAgentSecret: string;
    let bizBPrinterId: string;
    let bizBJobId: string;

    beforeAll(async () => {
      // Set up Biz B's own agent + printer
      const agentRes = await aPost(ownerBToken, '/admin/printing/agents', {
        locationId: locBId,
        name: `Biz B Agent ${RUN}`,
      });
      expect(agentRes.status).toBe(201);
      bizBAgentId = agentRes.body.id as string;
      bizBAgentSecret = agentRes.body.secret as string;

      const printerRes = await aPost(ownerBToken, '/admin/printing/printers', {
        locationId: locBId,
        agentId: bizBAgentId,
        name: `Biz B Printer ${RUN}`,
        purpose: 'RECEIPT',
        connectionType: 'NETWORK_ESC_POS',
      });
      expect(printerRes.status).toBe(201);
      bizBPrinterId = printerRes.body.id as string;

      // Create a job for Biz B
      const jobRes = await aPost(ownerBToken, '/admin/printing/jobs', {
        idempotencyKey: freshKey(),
        purpose: 'RECEIPT',
        sourceType: 'MANUAL',
        sourceId: 'biz-b-test',
        locationId: locBId,
        printerId: bizBPrinterId,
        payload: {},
      });
      expect(jobRes.status).toBe(201);
      bizBJobId = jobRes.body.id as string;
    });

    it('Biz A owner cannot see Biz B agents', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/agents/${bizBAgentId}`);
      expect(res.status).toBe(404);
    });

    it('Biz A owner cannot see Biz B printers', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/printers/${bizBPrinterId}`);
      expect(res.status).toBe(404);
    });

    it('Biz A owner cannot see Biz B jobs', async () => {
      const res = await aGet(ownerAToken, `/admin/printing/jobs/${bizBJobId}`);
      expect(res.status).toBe(404);
    });

    it('Biz A owner list does not include Biz B jobs', async () => {
      const res = await aGet(ownerAToken, '/admin/printing/jobs');
      expect(res.status).toBe(200);
      expect(res.body.some((j: { id: string }) => j.id === bizBJobId)).toBe(false);
    });

    it('Biz B agent cannot claim Biz A jobs', async () => {
      // Biz B agent only manages Biz B printers, so it must only see Biz B QUEUED jobs
      const res = await agentGet(bizBAgentSecret, '/agent/print/jobs');
      expect(res.status).toBe(200);
      // The claimed jobs must all belong to Biz B
      expect(res.body.every((j: { businessId: string }) => j.businessId === bizBId)).toBe(true);
    });

    it('Biz A agent cannot mark Biz B job as printed', async () => {
      // Biz B agent claims the Biz B job so it is SENT
      await agentGet(bizBAgentSecret, '/agent/print/jobs');
      // Biz A agent cannot see cross-business jobs — returns 404 (no info leakage)
      const res = await agentPost(agentSecret, `/agent/print/jobs/${bizBJobId}/printed`);
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Module gating
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Module gating: printing not active', () => {
    let ungatedBizId: string;
    let ungatedToken: string;

    beforeAll(async () => {
      const bizRes = await pPost('/internal/businesses', {
        name: `P10 Ungated ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      expect(bizRes.status).toBe(201);
      ungatedBizId = bizRes.body.id as string;
      ungatedToken = await provisionOwner(ungatedBizId, 'ungated');
      await mkLoc(ungatedBizId);
      // Activate prerequisites but NOT printing itself
      await activateModule(ungatedBizId, 'restaurant');
      await activateModule(ungatedBizId, 'catalog');
      await activateModule(ungatedBizId, 'checkout');
    });

    it('returns 403 MODULE_DISABLED on agents endpoint', async () => {
      const res = await aGet(ungatedToken, '/admin/printing/agents');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('returns 403 MODULE_DISABLED on printers endpoint', async () => {
      const res = await aGet(ungatedToken, '/admin/printing/printers');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('returns 403 MODULE_DISABLED on templates endpoint', async () => {
      const res = await aGet(ungatedToken, '/admin/printing/templates');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('returns 403 MODULE_DISABLED on jobs endpoint', async () => {
      const res = await aGet(ungatedToken, '/admin/printing/jobs');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });
  });
});
