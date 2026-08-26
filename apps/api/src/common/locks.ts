import { Prisma } from '@prisma/client';

/**
 * Acquire a transaction-scoped advisory lock for a business, serializing
 * concurrent mutations of that tenant (audit appends, setting upserts, number
 * allocation). The lock is re-entrant within a transaction and auto-released
 * on commit/rollback. Distinct businesses effectively never contend — the only
 * exception is an astronomically-rare 64-bit hash collision between two
 * business ids, which would merely serialize them (never a correctness issue).
 */
export async function lockBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  // $executeRaw (not $queryRaw): pg_advisory_xact_lock returns `void`, which
  // Prisma's row deserializer rejects; $executeRaw returns a row count instead.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${businessId}, 0))`;
}
