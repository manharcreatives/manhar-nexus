import { createHash } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { customerPayAvailable, customerPayFlag } from './customer-pay.config';
import { customerPaySchema } from './customer-pay.dto';
import { CustomerPayService } from './customer-pay.service';
import type { RegistrationPaymentService } from './registration-payment.service';

const REG = { id: 'reg-1', referenceCode: 'NX-ABC123', status: 'NEW', email: 'asha@example.com', planKey: 'floor', billingCycle: 'yearly' };
const ROW = {
  id: 'pay-1',
  registrationId: 'reg-1',
  linkId: 'NX-ABC123-ab12cd34',
  linkUrl: 'https://pay.test/l',
  amountPaise: 1_149_320,
  currency: 'INR',
  purpose: 'Manhar Nexus Floor, yearly',
  status: 'CREATED',
  paidAmountPaise: null,
  planKey: 'floor',
  billingCycle: 'yearly',
  quote: { lines: [{ label: 'Floor plan, yearly', amountPaise: 974_000 }] },
  source: 'CUSTOMER',
  expiresAt: new Date('2099-01-01T00:00:00Z'),
  paidAt: null,
  createdAt: new Date(),
};
const ASK = { referenceCode: 'NX-ABC123', email: 'asha@example.com' };
const NOW = new Date('2026-11-06T10:00:00Z');

function setup(f: { reg?: unknown; paid?: unknown; open?: unknown[]; created?: unknown } = {}) {
  const openQueue = [...(f.open ?? [])];
  const findFirst = jest.fn(async ({ where }: { where: { status: string } }) => {
    if (where.status === 'PAID') return f.paid ?? null;
    return openQueue.length > 0 ? openQueue.shift() : null;
  });
  const fake = {
    registrationRequest: { findUnique: jest.fn().mockResolvedValue('reg' in f ? f.reg : REG) },
    registrationPayment: { findFirst, findUniqueOrThrow: jest.fn().mockResolvedValue(f.created ?? ROW) },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma = { ...fake, $transaction: async (fn: (tx: unknown) => unknown) => fn(fake) } as unknown as PrismaService;
  const createLink = jest.fn().mockResolvedValue({ id: 'pay-1' });
  const refresh = jest.fn().mockResolvedValue({});
  const payments = { createLink, refresh } as unknown as RegistrationPaymentService;
  return { service: new CustomerPayService(prisma, payments), createLink, refresh, findFirst };
}

const saved = { ...process.env };
beforeEach(() => {
  process.env.CUSTOMER_PAY_ENABLED = 'true';
  process.env.CASHFREE_CLIENT_ID = 'id';
  process.env.CASHFREE_CLIENT_SECRET = 'secret';
});
afterEach(() => {
  process.env = { ...saved };
});

describe('the flag', () => {
  it('is off unless CUSTOMER_PAY_ENABLED is true or 1', () => {
    expect(customerPayFlag({})).toBe(false);
    expect(customerPayFlag({ CUSTOMER_PAY_ENABLED: 'false' })).toBe(false);
    expect(customerPayFlag({ CUSTOMER_PAY_ENABLED: 'yes' })).toBe(false);
    expect(customerPayFlag({ CUSTOMER_PAY_ENABLED: 'true' })).toBe(true);
    expect(customerPayFlag({ CUSTOMER_PAY_ENABLED: '1' })).toBe(true);
  });

  it('is not offered when the Cashfree keys are missing, even if switched on', () => {
    expect(customerPayAvailable({ CUSTOMER_PAY_ENABLED: 'true' })).toBe(false);
    expect(customerPayAvailable({ CUSTOMER_PAY_ENABLED: 'true', CASHFREE_CLIENT_ID: 'a', CASHFREE_CLIENT_SECRET: 'b' })).toBe(true);
  });

  it('with the flag off, pay and status are 404 and nothing is read', async () => {
    process.env.CUSTOMER_PAY_ENABLED = 'false';
    const { service, createLink, findFirst } = setup();
    await expect(service.pay(ASK, NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.status(ASK, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(createLink).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('customerPaySchema', () => {
  it('normalises the code and email, and refuses extra fields (a price or plan from the browser is never read)', () => {
    expect(customerPaySchema.parse({ referenceCode: ' nx-abc123 ', email: ' Asha@Example.COM ' })).toEqual(ASK);
    for (const bad of [{ ...ASK, amountPaise: 1 }, { ...ASK, planKey: 'pass' }, { referenceCode: 'x', email: 'a@b.co' }, { referenceCode: 'NX-ABC123', email: 'nope' }, {}]) {
      expect(customerPaySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('CustomerPayService.pay', () => {
  it('an unknown code and a wrong email get the very same 404', async () => {
    const unknown = await setup({ reg: null }).service.pay(ASK, NOW).catch((e: Error) => e);
    const wrong = await setup().service.pay({ ...ASK, email: 'other@example.com' }, NOW).catch((e: Error) => e);
    expect(unknown).toBeInstanceOf(NotFoundError);
    expect(wrong).toBeInstanceOf(NotFoundError);
    expect((unknown as Error).message).toBe((wrong as Error).message);
  });

  it('creates the link from the server quote only (empty body to createLink, source CUSTOMER) and returns just the link fields', async () => {
    const { service, createLink } = setup();
    const answer = await service.pay(ASK, NOW);
    expect(createLink).toHaveBeenCalledTimes(1);
    const call = createLink.mock.calls[0] as unknown[];
    expect(call.slice(1, 5)).toEqual(['reg-1', {}, NOW, 'CUSTOMER']);
    // Only the hash of the payer secret goes to the database; the secret itself is in the answer, once.
    const secret = (answer as { link: { payerSecret: string } }).link.payerSecret;
    expect(secret.length).toBeGreaterThanOrEqual(43);
    expect(call[5]).toBe(createHash('sha256').update(secret).digest('hex'));
    expect(answer).toEqual({
      outcome: 'link',
      link: {
        linkUrl: 'https://pay.test/l',
        amountPaise: 1_149_320,
        purpose: 'Manhar Nexus Floor, yearly',
        breakdown: [{ label: 'Floor plan, yearly', amountPaise: 974_000 }],
        expiresAt: ROW.expiresAt,
        payerSecret: secret,
      },
      // Also at the top level: the web reads it there (a contract; both places stay).
      payerSecret: secret,
    });
    expect(JSON.stringify(answer)).not.toMatch(/reg-1|pay-1|NX-ABC123|asha@/);
  });

  it('returns the existing open link instead of making a second one', async () => {
    const { service, createLink } = setup({ open: [ROW] });
    expect((await service.pay(ASK, NOW)).outcome).toBe('link');
    expect(createLink).not.toHaveBeenCalled();
  });

  it('says paid when it is already paid, and creates nothing', async () => {
    const { service, createLink } = setup({ paid: { ...ROW, status: 'PAID' } });
    expect(await service.pay(ASK, NOW)).toEqual({ outcome: 'paid' });
    expect(createLink).not.toHaveBeenCalled();
  });

  it.each([['many-doors'], ['not-sure']])('plan %s has no fixed price: "contact us", nothing created', async (planKey) => {
    const { service, createLink } = setup({ reg: { ...REG, planKey } });
    expect(await service.pay(ASK, NOW)).toEqual({ outcome: 'contact-us' });
    expect(createLink).not.toHaveBeenCalled();
  });

  it.each([['SPAM'], ['REJECTED'], ['CONVERTED']])('a %s request is not payable by the visitor', async (status) => {
    const { service, createLink } = setup({ reg: { ...REG, status } });
    expect(await service.pay(ASK, NOW)).toEqual({ outcome: 'contact-us' });
    expect(createLink).not.toHaveBeenCalled();
  });

  it('two taps at once: the loser gets the winner\'s link, not an error and not a second link', async () => {
    const { service, createLink } = setup({ open: [] });
    createLink.mockRejectedValueOnce(new ConflictError('already open', { openLinkIds: ['pay-1'] }));
    // first openLink() (before create) finds nothing; the re-check after the conflict finds the winner's link
    const queue: unknown[] = [null, ROW];
    (service as unknown as { openLink: () => Promise<unknown> }).openLink = async () => queue.shift() ?? null;
    expect((await service.pay(ASK, NOW)).outcome).toBe('link');
    expect(createLink).toHaveBeenCalledTimes(1);
  });

  it('a plan the quote refuses becomes "contact us" rather than a 400 for the visitor', async () => {
    const { service, createLink } = setup();
    createLink.mockRejectedValueOnce(new ValidationError('pick a plan', { needsPlan: true }));
    expect(await service.pay(ASK, NOW)).toEqual({ outcome: 'contact-us' });
  });

  it('lets a Cashfree failure through as an error (the page then offers "we will call you")', async () => {
    const { service, createLink } = setup();
    createLink.mockRejectedValueOnce(new Error('cashfree down'));
    await expect(service.pay(ASK, NOW)).rejects.toThrow('cashfree down');
  });
});

describe('CustomerPayService.status', () => {
  it('is paid=true when a link is PAID, without asking Cashfree', async () => {
    const { service, refresh } = setup({ paid: { ...ROW, status: 'PAID' } });
    expect(await service.status(ASK, NOW)).toEqual({ paid: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('is paid=false with no link at all', async () => {
    expect(await setup().service.status(ASK, NOW)).toEqual({ paid: false });
  });

  it('asks Cashfree about an open link, and a Cashfree failure just means "not yet"', async () => {
    const { service, refresh } = setup({ open: [ROW] });
    refresh.mockRejectedValueOnce(new Error('cashfree down'));
    expect(await service.status(ASK, NOW)).toEqual({ paid: false });
    expect(refresh).toHaveBeenCalledWith('reg-1', 'pay-1', NOW);
  });

  it('a wrong email is the same 404 as everywhere else', async () => {
    await expect(setup().service.status({ ...ASK, email: 'other@example.com' }, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});
