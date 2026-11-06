import type { PrismaService } from '../prisma/prisma.service';

/** A claim on one request while its Cashfree link is being created; stale after this long (a crashed instance). */
export const CREATE_LOCK_MS = 60_000;

/**
 * Claims the "creating a payment link" lock on a request: a compare-and-set on registration_request.payLockedAt, so it
 * works across API instances WITHOUT a transaction or advisory lock held while Cashfree is being called (with one pooled
 * connection that would starve every other query until the pool timed out). Returns the value written (the holder's
 * token) or null when somebody else holds a live claim.
 */
export async function claimCreateLock(prisma: PrismaService, registrationId: string, now: Date): Promise<Date | null> {
  const res = await prisma.registrationRequest.updateMany({
    where: { id: registrationId, OR: [{ payLockedAt: null }, { payLockedAt: { lt: new Date(now.getTime() - CREATE_LOCK_MS) } }] },
    data: { payLockedAt: now },
  });
  return res.count === 1 ? now : null;
}

/**
 * Releases the lock ONLY if it still holds the value this caller wrote. A stalled holder whose claim went stale and was
 * taken over must never clear the newer holder's lock (that would let a third caller create a second live link).
 */
export async function releaseCreateLock(prisma: PrismaService, registrationId: string, held: Date): Promise<void> {
  await prisma.registrationRequest.updateMany({ where: { id: registrationId, payLockedAt: held }, data: { payLockedAt: null } }).catch(() => undefined);
}
