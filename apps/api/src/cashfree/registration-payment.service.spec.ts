import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { CashfreeClient } from './cashfree.client';
import { PaymentsNotConfiguredError } from './cashfree.errors';
import { RegistrationPaymentService } from './registration-payment.service';

const ACTOR = { type: 'USER', id: 'staff-1', label: 'staff' } as never;
const REG = {
  id: 'reg-1',
  referenceCode: 'NX-ABC123',
  status: 'NEW',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+919714571522',
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
  expiresAt: null,
  paidAt: null,
  createdAt: new Date(),
};

interface Fakes {
  reg?: unknown;
  paidCount?: number;
  payment?: unknown;
  updateCount?: number;
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
      findMany: jest.fn().mockResolvedValue([PAYMENT]),
      create,
      updateMany,
    },
  } as unknown as PrismaService;
  const createLink = jest.fn().mockResolvedValue({ cfLinkId: '77', linkId: 'x', linkUrl: 'https://pay.test/new', status: 'ACTIVE' });
  const client = {
    config: jest.fn().mockReturnValue({}),
    createLink,
  } as unknown as CashfreeClient;
  return { service: new RegistrationPaymentService(prisma, client), createLink, create, updateMany, regUpdateMany, client };
}

describe('RegistrationPaymentService.createLink', () => {
  it('asks Cashfree with the owner details (10-digit phone, rupees as paise) and stores the link', async () => {
    const { service, createLink, create } = setup();
    const view = await service.createLink(ACTOR, 'reg-1', { amountRupees: 1500.5, purpose: 'Manhar Nexus subscription' });
    expect(createLink).toHaveBeenCalledTimes(1);
    const arg = createLink.mock.calls[0]?.[0];
    expect(arg.amountPaise).toBe(150_050);
    expect(arg.customer).toEqual({ name: 'Asha Patel', email: 'asha@example.com', phone: '9714571522' });
    expect(arg.linkId).toMatch(/^NX-ABC123-[0-9a-f]{8}$/);
    expect(arg.linkId.length).toBeLessThanOrEqual(50);
    expect(arg.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ registrationId: 'reg-1', amountPaise: 150_050, createdBy: 'staff-1', cfLinkId: '77' });
    expect(view.linkUrl).toBe('https://pay.test/new');
    expect(view).not.toHaveProperty('createdBy');
  });

  it('rounds rupee amounts to whole paise without floating-point drift', async () => {
    const { service, createLink } = setup();
    await service.createLink(ACTOR, 'reg-1', { amountRupees: 19.99, purpose: 'Manhar Nexus subscription' });
    expect(createLink.mock.calls[0]?.[0].amountPaise).toBe(1999);
  });

  it('is a 404 for an unknown request', async () => {
    const { service } = setup({ reg: null });
    await expect(service.createLink(ACTOR, 'nope', { amountRupees: 100, purpose: 'x y z' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['CONVERTED', 'SPAM', 'REJECTED'])('refuses a %s request without calling Cashfree', async (status) => {
    const { service, createLink } = setup({ reg: { ...REG, status } });
    await expect(service.createLink(ACTOR, 'reg-1', { amountRupees: 100, purpose: 'x y z' })).rejects.toBeInstanceOf(ValidationError);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('refuses a second link once one has been paid (no double charge)', async () => {
    const { service, createLink } = setup({ paidCount: 1 });
    await expect(service.createLink(ACTOR, 'reg-1', { amountRupees: 100, purpose: 'x y z' })).rejects.toBeInstanceOf(ConflictError);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('answers 503 (not a crash) when Cashfree is not configured, before creating anything', async () => {
    const { service, client, createLink, create } = setup();
    (client.config as jest.Mock).mockImplementation(() => {
      throw new PaymentsNotConfiguredError('not set up');
    });
    await expect(service.createLink(ACTOR, 'reg-1', { amountRupees: 100, purpose: 'x y z' })).rejects.toBeInstanceOf(PaymentsNotConfiguredError);
    expect(createLink).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
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
