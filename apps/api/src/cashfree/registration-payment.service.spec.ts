import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { CashfreeClient } from './cashfree.client';
import { PaymentProviderError, PaymentsNotConfiguredError } from './cashfree.errors';
import { RegistrationPaymentService, toPaymentView } from './registration-payment.service';

const ACTOR = { type: 'USER', id: 'staff-1', label: 'staff' } as never;
// Registered on 5 Nov 2026: inside the Founding window (1 Nov 2026 to 31 Jan 2027).
const REG = {
  id: 'reg-1',
  referenceCode: 'NX-ABC123',
  status: 'NEW',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+919714571522',
  planKey: 'floor',
  billingCycle: 'yearly',
  createdAt: new Date('2026-11-05T10:00:00+05:30'),
};
const PAYMENT = {
  id: 'pay-1',
  registrationId: 'reg-1',
  linkId: 'NX-ABC123-ab12cd34',
  linkUrl: 'https://pay.test/l',
  amountPaise: 150_000,
  currency: 'INR',
  purpose: 'Manhar Nexus subscription',
  status: 'CREATED',
  paidAmountPaise: null,
  planKey: null,
  billingCycle: null,
  quote: null,
  source: 'STAFF',
  expiresAt: null,
  paidAt: null,
  createdAt: new Date(),
};

interface Fakes {
  reg?: unknown;
  paidCount?: number;
  payment?: unknown;
  updateCount?: number;
  open?: unknown[];
}

function setup(f: Fakes = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: f.updateCount ?? 1 });
  const regUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...PAYMENT, ...data, id: 'pay-new', createdAt: new Date() }));
  const prisma = {
    registrationRequest: { findUnique: jest.fn().mockResolvedValue('reg' in f ? f.reg : REG), updateMany: regUpdateMany },
    registrationPayment: {
      count: jest.fn().mockResolvedValue(f.paidCount ?? 0),
      findUnique: jest.fn().mockResolvedValue('payment' in f ? f.payment : PAYMENT),
      findMany: jest.fn().mockResolvedValue(f.open ?? []),
      create,
      updateMany,
    },
  } as unknown as PrismaService;
  const createLink = jest.fn().mockResolvedValue({ cfLinkId: '77', linkId: 'x', linkUrl: 'https://pay.test/new', status: 'ACTIVE' });
  const cancelLink = jest.fn().mockResolvedValue(undefined);
  const client = { config: jest.fn().mockReturnValue({}), createLink, cancelLink } as unknown as CashfreeClient;
  return { service: new RegistrationPaymentService(prisma, client), createLink, cancelLink, create, updateMany, regUpdateMany, client };
}

describe('RegistrationPaymentService.createLink: priced from the plan catalog', () => {
  it('prices Floor yearly during Founding from the server catalog: 9,740 + 18% GST = 11,493.20', async () => {
    const { service, createLink, create } = setup();
    const view = await service.createLink(ACTOR, 'reg-1', {});
    const arg = createLink.mock.calls[0]?.[0];
    expect(arg.amountPaise).toBe(1_149_320);
    expect(arg.purpose).toBe('Manhar Nexus Floor, yearly (Founding 25% off), incl. 18% GST');
    expect(arg.customer).toEqual({ name: 'Asha Patel', email: 'asha@example.com', phone: '9714571522' });
    expect(arg.linkId).toMatch(/^NX-ABC123-[0-9a-f]{8}$/);
    expect(arg.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    const data = create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ amountPaise: 1_149_320, planKey: 'floor', billingCycle: 'yearly', source: 'STAFF', createdBy: 'staff-1' });
    expect(data.quote).toMatchObject({ foundingApplied: true, totalPaise: 1_149_320 });
    expect(view.breakdown?.map((l) => l.label)).toEqual([
      'Floor plan, yearly',
      'Founding Restaurants offer (25% off the first year)',
      'GST 18%',
    ]);
    expect(view.overrideReason).toBeNull();
  });

  it('judges the Founding offer at the registration date, so a lead keeps the price it signed up under', async () => {
    const early = setup({ reg: { ...REG, createdAt: new Date('2027-01-30T10:00:00+05:30') } });
    await early.service.createLink(ACTOR, 'reg-1', {}, new Date('2027-03-01T10:00:00+05:30'));
    expect(early.createLink.mock.calls[0]?.[0].amountPaise).toBe(1_149_320); // still Founding in March
    const late = setup({ reg: { ...REG, createdAt: new Date('2027-02-02T10:00:00+05:30') } });
    await late.service.createLink(ACTOR, 'reg-1', {});
    expect(late.createLink.mock.calls[0]?.[0].amountPaise).toBe(1_532_820); // list price + GST
  });

  it('lets staff pick the plan, cycle and Launch Pack when the visitor said "not sure"', async () => {
    const { service, createLink } = setup({ reg: { ...REG, planKey: 'not-sure', billingCycle: 'monthly', createdAt: new Date('2027-03-01T10:00:00+05:30') } });
    await service.createLink(ACTOR, 'reg-1', { planKey: 'counter', cycle: 'monthly', launchPack: true });
    // Counter monthly 599 + Launch Pack 3,499 = 4,098; GST 737.64; total 4,835.64
    expect(createLink.mock.calls[0]?.[0].amountPaise).toBe(483_564);
    expect(createLink.mock.calls[0]?.[0].purpose).toBe('Manhar Nexus Counter, monthly (with Launch Pack), incl. 18% GST');
  });

  it('refuses to price a request with no plan or a Many Doors plan, and asks Cashfree nothing', async () => {
    for (const planKey of ['not-sure', 'many-doors']) {
      const { service, createLink } = setup({ reg: { ...REG, planKey } });
      const err = (await service.createLink(ACTOR, 'reg-1', {}).then(() => null, (e: unknown) => e)) as ValidationError;
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details).toMatchObject({ needsPlan: true });
      expect(createLink).not.toHaveBeenCalled();
    }
  });

  it('a typed amount is charged as typed and its reason is stored (no plan recorded)', async () => {
    const { service, createLink, create } = setup();
    const view = await service.createLink(ACTOR, 'reg-1', { amountRupees: 1500.5, overrideReason: 'Agreed on the phone: pilot price' });
    expect(createLink.mock.calls[0]?.[0].amountPaise).toBe(150_050);
    const data = create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ planKey: null, billingCycle: null, quote: { override: { reason: 'Agreed on the phone: pilot price' } } });
    expect(view.overrideReason).toBe('Agreed on the phone: pilot price');
    expect(view.breakdown).toBeNull();
  });

  it('rounds a typed rupee amount to whole paise without floating-point drift', async () => {
    const { service, createLink } = setup();
    await service.createLink(ACTOR, 'reg-1', { amountRupees: 19.99, overrideReason: 'test amount' });
    expect(createLink.mock.calls[0]?.[0].amountPaise).toBe(1999);
  });

  it('is a 404 for an unknown request', async () => {
    const { service } = setup({ reg: null });
    await expect(service.createLink(ACTOR, 'nope', {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['CONVERTED', 'SPAM', 'REJECTED'])('refuses a %s request without calling Cashfree', async (status) => {
    const { service, createLink } = setup({ reg: { ...REG, status } });
    await expect(service.createLink(ACTOR, 'reg-1', {})).rejects.toBeInstanceOf(ValidationError);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('refuses a second link once one has been paid (no double charge)', async () => {
    const { service, createLink } = setup({ paidCount: 1 });
    await expect(service.createLink(ACTOR, 'reg-1', {})).rejects.toBeInstanceOf(ConflictError);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('answers 503 (not a crash) when Cashfree is not configured, before creating anything', async () => {
    const { service, client, createLink, create } = setup();
    (client.config as jest.Mock).mockImplementation(() => {
      throw new PaymentsNotConfiguredError('not set up');
    });
    await expect(service.createLink(ACTOR, 'reg-1', {})).rejects.toBeInstanceOf(PaymentsNotConfiguredError);
    expect(createLink).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('RegistrationPaymentService.createLink: one live link per request', () => {
  const OPEN = { ...PAYMENT, id: 'pay-open', linkId: 'NX-ABC123-open0001', expiresAt: new Date(Date.now() + 86_400_000) };

  it('an open link blocks a second one (409) and nothing is created or cancelled', async () => {
    const { service, createLink, cancelLink } = setup({ open: [OPEN] });
    const err = (await service.createLink(ACTOR, 'reg-1', {}).then(() => null, (e: unknown) => e)) as ConflictError;
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.details).toMatchObject({ openLinkIds: ['pay-open'] });
    expect(createLink).not.toHaveBeenCalled();
    expect(cancelLink).not.toHaveBeenCalled();
  });

  it('replaceOpen cancels the old link at Cashfree first, marks it CANCELLED, then creates the new one', async () => {
    const { service, createLink, cancelLink, updateMany } = setup({ open: [OPEN] });
    const order: string[] = [];
    cancelLink.mockImplementation(async () => void order.push('cancel'));
    createLink.mockImplementation(async () => {
      order.push('create');
      return { cfLinkId: '1', linkId: 'x', linkUrl: 'https://pay.test/new', status: 'ACTIVE' };
    });
    await service.createLink(ACTOR, 'reg-1', { replaceOpen: true });
    expect(order).toEqual(['cancel', 'create']);
    expect(cancelLink).toHaveBeenCalledWith('NX-ABC123-open0001');
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: 'pay-open', status: 'CREATED' }, data: { status: 'CANCELLED' } });
  });

  it('if Cashfree will not cancel the old link (say it was just paid) it stops: no second live link', async () => {
    const { service, createLink, cancelLink, create } = setup({ open: [OPEN] });
    cancelLink.mockRejectedValue(new PaymentProviderError('Cashfree said no (409): link already paid'));
    await expect(service.createLink(ACTOR, 'reg-1', { replaceOpen: true })).rejects.toBeInstanceOf(PaymentProviderError);
    expect(createLink).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('toPaymentView', () => {
  it('exposes the breakdown for a priced link and the reason for a typed one, never createdBy', () => {
    const priced = toPaymentView({ ...PAYMENT, planKey: 'floor', billingCycle: 'yearly', quote: { lines: [{ label: 'Floor plan, yearly', amountPaise: 1_299_000 }, { nope: 1 }] } } as never);
    expect(priced.breakdown).toEqual([{ label: 'Floor plan, yearly', amountPaise: 1_299_000 }]);
    expect(priced).not.toHaveProperty('createdBy');
    const typed = toPaymentView({ ...PAYMENT, quote: { override: { reason: 'pilot' } } } as never);
    expect(typed).toMatchObject({ breakdown: null, overrideReason: 'pilot' });
    expect(toPaymentView({ ...PAYMENT, quote: 'garbage' } as never)).toMatchObject({ breakdown: null, overrideReason: null });
  });
});

describe('RegistrationPaymentService.refresh ("Check payment": ask Cashfree directly)', () => {
  function withCashfree(link: { status: string; amountPaidRupees: number | null }, orderId: string | null = 'CFPay_9', f: Fakes = {}) {
    const s = setup(f);
    const getLink = jest.fn().mockResolvedValue({ cfLinkId: '1', linkId: PAYMENT.linkId, linkUrl: 'u', ...link });
    const getPaidOrderId = jest.fn().mockResolvedValue(orderId);
    Object.assign(s.client, { getLink, getPaidOrderId });
    return { ...s, getLink, getPaidOrderId };
  }

  it('turns a paid link into PAID exactly like a webhook would, recording the paid order id', async () => {
    const { service, updateMany, getPaidOrderId } = withCashfree({ status: 'PAID', amountPaidRupees: 1500 });
    const out = await service.refresh('reg-1', 'pay-1');
    expect(out.outcome).toBe('updated');
    expect(getPaidOrderId).toHaveBeenCalledWith(PAYMENT.linkId);
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { status: 'PAID', paidAmountPaise: 150_000, providerOrderId: 'CFPay_9' } });
  });

  it('changes nothing for a link that is still waiting for payment, and does not ask for orders', async () => {
    const { service, updateMany, getPaidOrderId } = withCashfree({ status: 'ACTIVE', amountPaidRupees: 0 });
    expect((await service.refresh('reg-1', 'pay-1')).outcome).toBe('ignored');
    expect(updateMany).not.toHaveBeenCalled();
    expect(getPaidOrderId).not.toHaveBeenCalled();
  });

  it('still refuses a wrong amount (AMOUNT_MISMATCH), never marks it paid', async () => {
    const { service, updateMany } = withCashfree({ status: 'PAID', amountPaidRupees: 1 });
    expect((await service.refresh('reg-1', 'pay-1')).outcome).toBe('amount-mismatch');
    expect(updateMany.mock.calls[0]?.[0].data.status).toBe('AMOUNT_MISMATCH');
  });

  it('is a 404 for a payment that belongs to another request, or does not exist, and asks Cashfree nothing', async () => {
    const other = withCashfree({ status: 'PAID', amountPaidRupees: 1500 }, 'x', { payment: { ...PAYMENT, registrationId: 'someone-else' } });
    await expect(other.service.refresh('reg-1', 'pay-1')).rejects.toBeInstanceOf(NotFoundError);
    const missing = withCashfree({ status: 'PAID', amountPaidRupees: 1500 }, 'x', { payment: null });
    await expect(missing.service.refresh('reg-1', 'nope')).rejects.toBeInstanceOf(NotFoundError);
    expect(other.getLink).not.toHaveBeenCalled();
    expect(missing.getLink).not.toHaveBeenCalled();
  });
});

describe('RegistrationPaymentService.applyLinkEvent', () => {
  const paid = (over: Record<string, unknown> = {}) => ({
    linkId: PAYMENT.linkId,
    linkStatus: 'PAID',
    amountPaidRupees: 1500,
    orderId: 'CFPay_1',
    ...over,
  });

  it('ignores a link it does not know (another system, or a forged id)', async () => {
    const { service, updateMany } = setup({ payment: null });
    expect(await service.applyLinkEvent(paid())).toBe('ignored');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('marks a matching payment PAID, records the order, and qualifies the request', async () => {
    const { service, updateMany, regUpdateMany } = setup();
    expect(await service.applyLinkEvent(paid())).toBe('updated');
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'pay-1', status: { not: 'PAID' } },
      data: { status: 'PAID', paidAmountPaise: 150_000, providerOrderId: 'CFPay_1' },
    });
    expect(regUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: 'reg-1', status: { in: ['NEW', 'CONTACTED'] } }, data: { status: 'QUALIFIED' } });
  });

  it('treats a repeat of a paid event as a duplicate and changes nothing', async () => {
    const { service, updateMany } = setup({ payment: { ...PAYMENT, status: 'PAID' } });
    expect(await service.applyLinkEvent(paid())).toBe('duplicate');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('survives two retries racing: the loser of the compare-and-set is a duplicate and qualifies nothing twice', async () => {
    const { service, regUpdateMany } = setup({ updateCount: 0 });
    expect(await service.applyLinkEvent(paid())).toBe('duplicate');
    expect(regUpdateMany).not.toHaveBeenCalled();
  });

  it('does NOT treat a wrong or missing amount as paid: it flags AMOUNT_MISMATCH for a human', async () => {
    for (const amountPaidRupees of [1000, 1500.01, null]) {
      const { service, updateMany, regUpdateMany } = setup();
      expect(await service.applyLinkEvent(paid({ amountPaidRupees }))).toBe('amount-mismatch');
      expect(updateMany.mock.calls[0]?.[0].data.status).toBe('AMOUNT_MISMATCH');
      expect(regUpdateMany).not.toHaveBeenCalled();
    }
  });

  it('lets a real PAID win over an earlier mismatch or expiry (money moved)', async () => {
    for (const status of ['AMOUNT_MISMATCH', 'EXPIRED', 'CANCELLED']) {
      const { service } = setup({ payment: { ...PAYMENT, status } });
      expect(await service.applyLinkEvent(paid())).toBe('updated');
    }
  });

  it('applies EXPIRED / CANCELLED only to a link that is still CREATED, never to a paid one', async () => {
    const created = setup();
    expect(await created.service.applyLinkEvent(paid({ linkStatus: 'EXPIRED', amountPaidRupees: null }))).toBe('updated');
    expect(created.updateMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: 'pay-1', status: 'CREATED' }, data: { status: 'EXPIRED' } });

    const alreadyPaid = setup({ payment: { ...PAYMENT, status: 'PAID' }, updateCount: 0 });
    expect(await alreadyPaid.service.applyLinkEvent(paid({ linkStatus: 'CANCELLED' }))).toBe('duplicate');
  });

  it('ignores states it does not act on', async () => {
    for (const linkStatus of ['ACTIVE', 'PARTIALLY_PAID', 'SOMETHING_NEW']) {
      const { service, updateMany } = setup();
      expect(await service.applyLinkEvent(paid({ linkStatus }))).toBe('ignored');
      expect(updateMany).not.toHaveBeenCalled();
    }
  });
});
