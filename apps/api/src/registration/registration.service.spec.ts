import type { ConfigService } from '@nestjs/config';
import { RateLimitedError } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { CONSENT_VERSIONS, createRegistrationSchema } from './registration.dto';
import { EMAIL_DAILY_CAP, IP_HOURLY_CAP, RegistrationService } from './registration.service';

const dto = createRegistrationSchema.parse({
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+91 97145 71522',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: 2,
  consent: true,
  consentVersion: CONSENT_VERSIONS[0],
});
const META = { ip: '203.0.113.7', userAgent: 'jest' };

/** A fake Prisma that reports the given number of recent requests for the IP and for the email. */
function setup(counts: { ip?: number; email?: number } = {}) {
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'r-1', ...data }));
  const count = jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
    'ipHash' in where ? (counts.ip ?? 0) : (counts.email ?? 0),
  );
  const prisma = { registrationRequest: { count, create } } as unknown as PrismaService;
  const config = { get: (_k: string, d?: unknown) => d } as unknown as ConfigService;
  return { service: new RegistrationService(prisma, config), create, count };
}

describe('RegistrationService.submit: abuse caps tell the truth', () => {
  it('stores a normal request and acknowledges it with its reference code', async () => {
    const { service, create } = setup();
    const ack = await service.submit(dto, META);
    expect(ack.ok).toBe(true);
    expect(ack.referenceCode).toMatch(/^NX-/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].data.status).toBe('NEW');
  });

  it('refuses a request over the per-IP cap with a 429, never a reference code, and stores nothing', async () => {
    const { service, create } = setup({ ip: IP_HOURLY_CAP });
    const err = await service.submit(dto, META).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RateLimitedError);
    const e = err as RateLimitedError;
    expect(e.httpStatus).toBe(429);
    expect(e.details).toMatchObject({ kind: 'ip', retryAfterSeconds: 3600 });
    expect(create).not.toHaveBeenCalled();
  });

  it('tells a person over the per-email cap that their request is already on file (it is), and stores nothing new', async () => {
    const { service, create } = setup({ email: EMAIL_DAILY_CAP });
    const err = (await service.submit(dto, META).then(
      () => null,
      (e: unknown) => e,
    )) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.details).toMatchObject({ kind: 'email' });
    expect(err.message).toMatch(/already have your request/i);
    expect(create).not.toHaveBeenCalled();
  });

  it('still answers bots (honeypot filled) with the same acknowledgement, storing the row as SPAM', async () => {
    const { service, create } = setup();
    const ack = await service.submit({ ...dto, website: 'http://spam.example' }, META);
    expect(Object.keys(ack).sort()).toEqual(['ok', 'referenceCode']);
    expect(create.mock.calls[0]?.[0].data.status).toBe('SPAM');
  });

  it('lets a request through just under both caps', async () => {
    const { service, create } = setup({ ip: IP_HOURLY_CAP - 1, email: EMAIL_DAILY_CAP - 1 });
    await expect(service.submit(dto, META)).resolves.toMatchObject({ ok: true });
    expect(create).toHaveBeenCalled();
  });
});
