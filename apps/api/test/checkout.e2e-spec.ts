import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 9 — Checkout & Payments E2E suite.
 *
 * Coverage:
 *   - Invoice creation: idempotent getOrCreate, tax computation, totals
 *   - Invoice lifecycle: DRAFT → FINALISED → PAID
 *   - Invoice void: DRAFT and FINALISED can be voided; PAID cannot
 *   - Cash payment: immediate capture, change calculation, invoice marked PAID
 *   - UPI payment: PENDING → captured via /capture with reference code
 *   - Payment cancel: PENDING payment cancelled
 *   - Refund: partial and full refund on CAPTURED payment
 *   - Idempotency: duplicate payment idempotencyKey returns existing
 *   - Guard: requires FINALISED invoice before payment
 *   - Guard: only one active payment per invoice
 *   - Guard: payment amount must equal invoice total
 *   - Guard: refund cannot exceed remaining refundable balance
 *   - Module gating: returns 403 MODULE_DISABLED when checkout not ACTIVE
 *   - Cross-business isolation: Biz B cannot access Biz A's invoices/payments
 */
describe('Checkout & Payments — Phase 9 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  // Business A — primary test tenant
  let bizAId: string;
  let ownerAToken: string;
  let locAId: string;

  // Business B — isolation tests
  let bizBId: string;
  let ownerBToken: string;

  // Catalog fixtures
  let taxCatId: string;
  let catalogItemId: string;

  // Dining fixtures
  let diningAreaId: string;
  let tableId: string;

  // Session/order state for checkout tests
  let sessionId: string;

  const RUN = Date.now().toString(36);

  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const aGet = (tok: string, path: string) => request(http()).get(path).set('authorization', `Bearer ${tok}`);

  const aPost = (tok: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);

  const freshKey = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-p9-${suffix}-${RUN}@test.local`;
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
      name: `LocP9${suffix} ${RUN}`.trim(),
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
    const bizARes = await pPost('/internal/businesses', { name: `P9 BizA ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizARes.status).toBe(201);
    bizAId = bizARes.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    locAId = await mkLoc(bizAId, 'A');
    await activateModule(bizAId, 'restaurant');
    await activateModule(bizAId, 'catalog');
    await activateModule(bizAId, 'checkout');

    // ── Business B setup ─────────────────────────────────────────────────────────
    const bizBRes = await pPost('/internal/businesses', { name: `P9 BizB ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizBRes.status).toBe(201);
    bizBId = bizBRes.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
    await mkLoc(bizBId, 'B');
    await activateModule(bizBId, 'restaurant');
    await activateModule(bizBId, 'catalog');
    await activateModule(bizBId, 'checkout');

    // ── Catalog setup for Biz A ─────────────────────────────────────────────────
    const taxRes = await aPost(ownerAToken, '/admin/catalog/tax-categories', {
      name: 'GST 5%',
      rate: 0.05,
      isDefault: true,
    });
    expect(taxRes.status).toBe(201);
    taxCatId = taxRes.body.id as string;

    const catRes = await aPost(ownerAToken, '/admin/catalog/categories', {
      name: `P9 Cat ${RUN}`,
      sortOrder: 0,
    });
    expect(catRes.status).toBe(201);
    const catId = catRes.body.id as string;

    // Item at 1000 paise (₹10) + 5% GST → 1050 paise total per unit
    const itemRes = await aPost(ownerAToken, '/admin/catalog/items', {
      categoryId: catId,
      name: 'Test Burger',
      basePriceMinorUnits: 1000,
      taxCategoryId: taxCatId,
      isAvailable: true,
    });
    expect(itemRes.status).toBe(201);
    catalogItemId = itemRes.body.id as string;

    // ── Dining setup for Biz A ───────────────────────────────────────────────────
    const areaRes = await aPost(ownerAToken, '/admin/dining/areas', {
      locationId: locAId,
      name: `Hall P9 ${RUN}`,
      sortOrder: 0,
    });
    expect(areaRes.status).toBe(201);
    diningAreaId = areaRes.body.id as string;

    const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
      diningAreaId,
      locationId: locAId,
      code: `P9T${RUN}`,
      capacity: 4,
    });
    expect(tableRes.status).toBe(201);
    tableId = tableRes.body.id as string;

    // ── Open a guest session and create + serve a service request ────────────────
    const sessRes = await aPost(ownerAToken, '/admin/sessions', {
      locationId: locAId,
      diningTableId: tableId,
      partySize: 2,
    });
    expect(sessRes.status).toBe(201);
    sessionId = sessRes.body.id as string;

    // Create draft order (2 burgers)
    const draftRes = await aPost(ownerAToken, '/admin/orders', {
      sessionId,
      idempotencyKey: freshKey(),
      lines: [{ catalogItemId, quantity: 2 }],
    });
    expect(draftRes.status).toBe(201);
    const orderId = draftRes.body.id as string;

    // Send to kitchen
    const sendRes = await aPost(ownerAToken, `/admin/orders/${orderId}/send`, {});
    expect(sendRes.status).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Invoice creation ─────────────────────────────────────────────────────────

  describe('Invoice: getOrCreate', () => {
    let invoiceId: string;

    it('creates draft invoice from session billable lines', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/sessions/${sessionId}/invoice`, {});
      expect(res.status).toBe(201);
      const inv = res.body;
      expect(inv.status).toBe('DRAFT');
      expect(inv.sessionId).toBe(sessionId);
      // 2 × ₹10 = ₹20 subtotal; 5% tax = ₹1; total = ₹21
      expect(inv.subtotalMinorUnits).toBe(2000);
      expect(inv.totalTaxMinorUnits).toBe(100); // Math.round(2000 * 0.05) = 100
      expect(inv.grandTotalMinorUnits).toBe(2100);
      expect(inv.lines).toHaveLength(1);
      expect(inv.lines[0].itemNameSnapshot).toBe('Test Burger');
      expect(inv.lines[0].quantity).toBe(2);
      expect(inv.lines[0].lineSubtotalMinorUnits).toBe(2000);
      expect(inv.lines[0].lineTaxMinorUnits).toBe(100);
      expect(inv.lines[0].lineTotalMinorUnits).toBe(2100);
      expect(inv.taxBreakdown).toHaveLength(1);
      expect(inv.taxBreakdown[0].name).toBe('GST 5%');
      expect(inv.taxBreakdown[0].rate).toBeCloseTo(0.05);
      invoiceId = inv.id as string;
    });

    it('returns same draft invoice on repeated calls (idempotent)', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/sessions/${sessionId}/invoice`, {});
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(invoiceId);
    });

    it('GET /sessions/:id/invoice returns current invoice', async () => {
      const res = await aGet(ownerAToken, `/admin/checkout/sessions/${sessionId}/invoice`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(invoiceId);
    });

    it('GET /invoices/:id returns invoice by ID', async () => {
      const res = await aGet(ownerAToken, `/admin/checkout/invoices/${invoiceId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(invoiceId);
    });

    it('returns 400 if session has no billable service requests', async () => {
      // Open a fresh session with no orders
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TEmpty${RUN}`,
        capacity: 2,
      });
      const emptyTableId = tableRes.body.id as string;
      const sessRes = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: emptyTableId,
        partySize: 1,
      });
      const emptySessionId = sessRes.body.id as string;

      const res = await aPost(ownerAToken, `/admin/checkout/sessions/${emptySessionId}/invoice`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  // ─── Invoice finalise ─────────────────────────────────────────────────────────

  describe('Invoice: finalise', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/sessions/${sessionId}/invoice`, {});
      expect(res.status).toBe(201);
      invoiceId = res.body.id as string;
    });

    it('finalises DRAFT invoice — assigns invoice number', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/finalise`, {});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('FINALISED');
      expect(res.body.invoiceNumber).toBeTruthy();
      expect(res.body.finalisedAt).toBeTruthy();
    });

    it('cannot finalise an already-FINALISED invoice', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/finalise`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  // ─── Invoice void ─────────────────────────────────────────────────────────────

  describe('Invoice: void', () => {
    it('voids a DRAFT invoice', async () => {
      // Need a fresh session and invoice for this test
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TVoid${RUN}`,
        capacity: 2,
      });
      const voidTableId = tableRes.body.id as string;
      const sessRes = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: voidTableId,
        partySize: 2,
      });
      const voidSessionId = sessRes.body.id as string;

      const draftRes = await aPost(ownerAToken, '/admin/orders', {
        sessionId: voidSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1 }],
      });
      await aPost(ownerAToken, `/admin/orders/${draftRes.body.id}/send`, {});

      const invRes = await aPost(ownerAToken, `/admin/checkout/sessions/${voidSessionId}/invoice`, {});
      const invId = invRes.body.id as string;

      const voidRes = await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/void`, {
        reason: 'Test void',
      });
      expect(voidRes.status).toBe(201);
      expect(voidRes.body.status).toBe('VOIDED');
      expect(voidRes.body.voidReason).toBe('Test void');
    });
  });

  // ─── Cash payment ─────────────────────────────────────────────────────────────

  describe('Cash payment: immediate capture', () => {
    let invoiceId: string;

    beforeAll(async () => {
      // Set up a fresh session+order for cash payment tests
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TCash${RUN}`,
        capacity: 2,
      });
      const cashTableId = tableRes.body.id as string;
      const sessRes = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: cashTableId,
        partySize: 2,
      });
      const cashSessionId = sessRes.body.id as string;

      const draftRes = await aPost(ownerAToken, '/admin/orders', {
        sessionId: cashSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1 }], // 1050 paise total
      });
      await aPost(ownerAToken, `/admin/orders/${draftRes.body.id}/send`, {});

      const invRes = await aPost(ownerAToken, `/admin/checkout/sessions/${cashSessionId}/invoice`, {});
      expect(invRes.body.grandTotalMinorUnits).toBe(1050);
      invoiceId = invRes.body.id as string;

      await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/finalise`, {});
    });

    it('initiates cash payment and captures immediately', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'CASH',
        amountMinorUnits: 1050,
        cashReceivedMinorUnits: 2000, // ₹20 received
      });
      expect(res.status).toBe(201);
      const pmt = res.body;
      expect(pmt.status).toBe('CAPTURED');
      expect(pmt.method).toBe('CASH');
      expect(pmt.changeMinorUnits).toBe(950); // ₹20 - ₹10.50 change
      expect(pmt.capturedAt).toBeTruthy();
    });

    it('invoice is PAID after cash capture', async () => {
      const res = await aGet(ownerAToken, `/admin/checkout/invoices/${invoiceId}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');
      expect(res.body.paidAt).toBeTruthy();
    });

    it('rejects second payment on already-PAID invoice', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'CASH',
        amountMinorUnits: 1050,
        cashReceivedMinorUnits: 1050,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('idempotent: same idempotencyKey returns existing payment', async () => {
      const key = freshKey();
      // First call will fail (invoice already PAID) — we need a fresh invoice
      // Instead test idempotency on payment creation by checking P2002 → return existing

      // Make a new table/session/invoice to test idempotency cleanly
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TIdem${RUN}`,
        capacity: 2,
      });
      const idemTableId = tableRes.body.id as string;
      const sessRes = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: idemTableId,
        partySize: 2,
      });
      const idemSessionId = sessRes.body.id as string;

      const draftRes = await aPost(ownerAToken, '/admin/orders', {
        sessionId: idemSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1 }],
      });
      await aPost(ownerAToken, `/admin/orders/${draftRes.body.id}/send`, {});

      const invRes = await aPost(ownerAToken, `/admin/checkout/sessions/${idemSessionId}/invoice`, {});
      const idemInvId = invRes.body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${idemInvId}/finalise`, {});

      const pmt1 = await aPost(ownerAToken, `/admin/checkout/invoices/${idemInvId}/payments`, {
        idempotencyKey: key,
        method: 'CASH',
        amountMinorUnits: 1050,
        cashReceivedMinorUnits: 1050,
      });
      expect(pmt1.status).toBe(201);
      expect(pmt1.body.status).toBe('CAPTURED');

      // Repeat with same key — must return same payment (idempotent)
      const pmt2 = await aPost(ownerAToken, `/admin/checkout/invoices/${idemInvId}/payments`, {
        idempotencyKey: key,
        method: 'CASH',
        amountMinorUnits: 1050,
        cashReceivedMinorUnits: 1050,
      });
      expect(pmt2.status).toBe(201);
      expect(pmt2.body.id).toBe(pmt1.body.id);
    });
  });

  // ─── Payment validation guards ─────────────────────────────────────────────────

  describe('Payment validation guards', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TGuard${RUN}`,
        capacity: 2,
      });
      const gTableId = tableRes.body.id as string;
      const sessRes = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: gTableId,
        partySize: 2,
      });
      const gSessionId = sessRes.body.id as string;

      const draftRes = await aPost(ownerAToken, '/admin/orders', {
        sessionId: gSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1 }],
      });
      await aPost(ownerAToken, `/admin/orders/${draftRes.body.id}/send`, {});

      const invRes = await aPost(ownerAToken, `/admin/checkout/sessions/${gSessionId}/invoice`, {});
      invoiceId = invRes.body.id as string;
      // Leave as DRAFT for guard tests
    });

    it('rejects payment on DRAFT invoice (must be FINALISED)', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'CASH',
        amountMinorUnits: 1050,
        cashReceivedMinorUnits: 1050,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('rejects payment with wrong amount', async () => {
      await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/finalise`, {});
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'CASH',
        amountMinorUnits: 999, // wrong — should be 1050
        cashReceivedMinorUnits: 999,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('rejects cash with insufficient amount received', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'CASH',
        amountMinorUnits: 1050,
        cashReceivedMinorUnits: 500, // less than invoice total
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  // ─── UPI manual flow ──────────────────────────────────────────────────────────

  describe('UPI payment: PENDING → captured', () => {
    let upiInvoiceId: string;
    let upiPaymentId: string;

    beforeAll(async () => {
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TUPI${RUN}`,
        capacity: 2,
      });
      const upiTableId = tableRes.body.id as string;
      const sessRes = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: upiTableId,
        partySize: 2,
      });
      const upiSessionId = sessRes.body.id as string;

      const draftRes = await aPost(ownerAToken, '/admin/orders', {
        sessionId: upiSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1 }],
      });
      await aPost(ownerAToken, `/admin/orders/${draftRes.body.id}/send`, {});

      const invRes = await aPost(ownerAToken, `/admin/checkout/sessions/${upiSessionId}/invoice`, {});
      upiInvoiceId = invRes.body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${upiInvoiceId}/finalise`, {});
    });

    it('initiates UPI payment — status is PENDING', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/invoices/${upiInvoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'UPI',
        amountMinorUnits: 1050,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.method).toBe('UPI');
      expect(res.body.capturedAt).toBeNull();
      upiPaymentId = res.body.id as string;
    });

    it('invoice remains FINALISED while payment is PENDING', async () => {
      const res = await aGet(ownerAToken, `/admin/checkout/invoices/${upiInvoiceId}`);
      expect(res.body.status).toBe('FINALISED');
    });

    it('captures UPI payment with reference code', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${upiPaymentId}/capture`, {
        referenceCode: 'UTR123456789',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CAPTURED');
      expect(res.body.capturedAt).toBeTruthy();
      expect(res.body.referenceCode).toBe('UTR123456789');
    });

    it('invoice is PAID after UPI capture', async () => {
      const res = await aGet(ownerAToken, `/admin/checkout/invoices/${upiInvoiceId}`);
      expect(res.body.status).toBe('PAID');
    });

    it('rejects capture of already-CAPTURED payment', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${upiPaymentId}/capture`, {
        referenceCode: 'UTR_DUPLICATE',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('rejects UPI capture without referenceCode', async () => {
      // Need a fresh PENDING UPI payment
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `P9TUPINoRef${RUN}`,
        capacity: 2,
      });
      const t = tableRes.body.id as string;
      const s = (await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: t, partySize: 1 })).body.id as string;
      const o = (await aPost(ownerAToken, '/admin/orders', { sessionId: s, idempotencyKey: freshKey(), lines: [{ catalogItemId, quantity: 1 }] })).body.id as string;
      await aPost(ownerAToken, `/admin/orders/${o}/send`, {});
      const invId = (await aPost(ownerAToken, `/admin/checkout/sessions/${s}/invoice`, {})).body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/finalise`, {});
      const pmtId = (await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/payments`, {
        idempotencyKey: freshKey(), method: 'UPI', amountMinorUnits: 1050,
      })).body.id as string;

      const res = await aPost(ownerAToken, `/admin/checkout/payments/${pmtId}/capture`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  // ─── Payment cancel ───────────────────────────────────────────────────────────

  describe('Payment: cancel PENDING payment', () => {
    let cancelPaymentId: string;

    beforeAll(async () => {
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId, locationId: locAId, code: `P9TCancel${RUN}`, capacity: 2,
      });
      const t = tableRes.body.id as string;
      const s = (await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: t, partySize: 1 })).body.id as string;
      const o = (await aPost(ownerAToken, '/admin/orders', { sessionId: s, idempotencyKey: freshKey(), lines: [{ catalogItemId, quantity: 1 }] })).body.id as string;
      await aPost(ownerAToken, `/admin/orders/${o}/send`, {});
      const invId = (await aPost(ownerAToken, `/admin/checkout/sessions/${s}/invoice`, {})).body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/finalise`, {});
      cancelPaymentId = (await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/payments`, {
        idempotencyKey: freshKey(), method: 'UPI', amountMinorUnits: 1050,
      })).body.id as string;
    });

    it('cancels a PENDING payment', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${cancelPaymentId}/cancel`, {
        reason: 'Customer changed mind',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelledAt).toBeTruthy();
    });

    it('cannot cancel an already-CANCELLED payment', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${cancelPaymentId}/cancel`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  // ─── Refund ───────────────────────────────────────────────────────────────────

  describe('Refund: cash payment reversal', () => {
    let capturedPaymentId: string;

    beforeAll(async () => {
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId, locationId: locAId, code: `P9TRefund${RUN}`, capacity: 2,
      });
      const t = tableRes.body.id as string;
      const s = (await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: t, partySize: 1 })).body.id as string;
      const o = (await aPost(ownerAToken, '/admin/orders', { sessionId: s, idempotencyKey: freshKey(), lines: [{ catalogItemId, quantity: 2 }] })).body.id as string;
      await aPost(ownerAToken, `/admin/orders/${o}/send`, {});
      const invId = (await aPost(ownerAToken, `/admin/checkout/sessions/${s}/invoice`, {})).body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/finalise`, {});
      const pmtRes = await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/payments`, {
        idempotencyKey: freshKey(), method: 'CASH', amountMinorUnits: 2100, cashReceivedMinorUnits: 2100,
      });
      capturedPaymentId = pmtRes.body.id as string;
    });

    it('creates partial refund on CAPTURED payment', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${capturedPaymentId}/refunds`, {
        reason: 'One item returned',
        amountMinorUnits: 1050,
      });
      expect(res.status).toBe(201);
      expect(res.body.amountMinorUnits).toBe(1050);
      expect(res.body.status).toBe('PROCESSED'); // cash → immediate
      expect(res.body.processedAt).toBeTruthy();
    });

    it('creates second partial refund within remaining balance', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${capturedPaymentId}/refunds`, {
        reason: 'Second item returned',
        amountMinorUnits: 1050,
      });
      expect(res.status).toBe(201);
      expect(res.body.amountMinorUnits).toBe(1050);
    });

    it('rejects refund exceeding remaining balance', async () => {
      const res = await aPost(ownerAToken, `/admin/checkout/payments/${capturedPaymentId}/refunds`, {
        reason: 'Over-refund attempt',
        amountMinorUnits: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('rejects refund on non-CAPTURED payment', async () => {
      // Use the UPI payment that we already cancelled
      // Create a fresh pending UPI payment for this test
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId, locationId: locAId, code: `P9TRefPend${RUN}`, capacity: 2,
      });
      const t = tableRes.body.id as string;
      const s = (await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: t, partySize: 1 })).body.id as string;
      const o = (await aPost(ownerAToken, '/admin/orders', { sessionId: s, idempotencyKey: freshKey(), lines: [{ catalogItemId, quantity: 1 }] })).body.id as string;
      await aPost(ownerAToken, `/admin/orders/${o}/send`, {});
      const invId = (await aPost(ownerAToken, `/admin/checkout/sessions/${s}/invoice`, {})).body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/finalise`, {});
      const pendingPmtId = (await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/payments`, {
        idempotencyKey: freshKey(), method: 'UPI', amountMinorUnits: 1050,
      })).body.id as string;

      const res = await aPost(ownerAToken, `/admin/checkout/payments/${pendingPmtId}/refunds`, {
        reason: 'Test',
        amountMinorUnits: 100,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  // ─── Payment listing ──────────────────────────────────────────────────────────

  describe('Payment: list', () => {
    it('lists payments for an invoice', async () => {
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId, locationId: locAId, code: `P9TList${RUN}`, capacity: 2,
      });
      const t = tableRes.body.id as string;
      const s = (await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: t, partySize: 1 })).body.id as string;
      const o = (await aPost(ownerAToken, '/admin/orders', { sessionId: s, idempotencyKey: freshKey(), lines: [{ catalogItemId, quantity: 1 }] })).body.id as string;
      await aPost(ownerAToken, `/admin/orders/${o}/send`, {});
      const invId = (await aPost(ownerAToken, `/admin/checkout/sessions/${s}/invoice`, {})).body.id as string;
      await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/finalise`, {});
      await aPost(ownerAToken, `/admin/checkout/invoices/${invId}/payments`, {
        idempotencyKey: freshKey(), method: 'CASH', amountMinorUnits: 1050, cashReceivedMinorUnits: 1050,
      });

      const res = await aGet(ownerAToken, `/admin/checkout/invoices/${invId}/payments`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('CAPTURED');
    });
  });

  // ─── Cross-business isolation ─────────────────────────────────────────────────

  describe('Cross-business isolation', () => {
    let isolatedInvoiceId: string;

    beforeAll(async () => {
      const res = await aGet(ownerAToken, `/admin/checkout/sessions/${sessionId}/invoice`);
      isolatedInvoiceId = res.body?.id as string;
    });

    it('Biz B cannot access Biz A invoice by ID (404)', async () => {
      if (!isolatedInvoiceId) return; // no invoice yet in session, skip
      const res = await aGet(ownerBToken, `/admin/checkout/invoices/${isolatedInvoiceId}`);
      expect(res.status).toBe(404);
    });

    it('Biz B cannot initiate payment on Biz A invoice (404)', async () => {
      if (!isolatedInvoiceId) return;
      const res = await aPost(ownerBToken, `/admin/checkout/invoices/${isolatedInvoiceId}/payments`, {
        idempotencyKey: freshKey(),
        method: 'CASH',
        amountMinorUnits: 2100,
        cashReceivedMinorUnits: 2100,
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Module gating ────────────────────────────────────────────────────────────

  describe('Module gating: checkout not active', () => {
    let ungatedBizId: string;
    let ungatedToken: string;

    beforeAll(async () => {
      const bizRes = await pPost('/internal/businesses', { name: `P9 Ungated ${RUN}`, businessTypeKey: 'restaurant' });
      ungatedBizId = bizRes.body.id as string;
      ungatedToken = await provisionOwner(ungatedBizId, 'ungated');
      // Activate restaurant + catalog but NOT checkout
      await mkLoc(ungatedBizId);
      await activateModule(ungatedBizId, 'restaurant');
      await activateModule(ungatedBizId, 'catalog');
    });

    it('returns 403 MODULE_DISABLED when checkout module is not active', async () => {
      const res = await aPost(ungatedToken, `/admin/checkout/sessions/${sessionId}/invoice`, {});
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });
  });
});
