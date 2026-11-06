import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../core/audit/audit.service';
import { ConflictError, NotFoundError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { PasswordService } from '../iam/password.service';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { AutoProvisionService, isAutoEligiblePayment } from './auto-provision.service';
import type { ProvisionInput } from './provisioning.dto';

export const CLAIM_TTL_MS = 72 * 3_600_000;
/** Wrong guesses allowed per reference code per window before it answers 404 to everything for a while. */
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 3_600_000;

/** One answer for every way the proof can be wrong, so the endpoint cannot be used to learn which part was right. */
export const CLAIM_NOT_FOUND = 'We could not find a request with those details.';
export const CLAIM_LINK_INVALID = 'This link is not valid any more. Ask us for a new one.';

export const claimIssueSchema = z
  .object({
    referenceCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{3,31}$/),
    email: z.string().trim().toLowerCase().email().max(254),
    payerSecret: z.string().min(16).max(200),
  })
  .strict();
export type ClaimIssueDto = z.infer<typeof claimIssueSchema>;

export const claimRedeemSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(8).max(200),
  })
  .strict();
export type ClaimRedeemDto = z.infer<typeof claimRedeemSchema>;

export type ClaimIssueAnswer = { status: 'ready'; token: string; expiresAt: Date } | { status: 'pending' };

const sha256hex = (v: string): string => createHash('sha256').update(v).digest('hex');
const digest = (v: string): Buffer => createHash('sha256').update(v).digest();

/** Timing-safe equality of a digest with a stored sha256 hex string (false for null or a malformed value). */
function sameHash(given: Buffer, storedHex: string | null): boolean {
  const stored = storedHex ? Buffer.from(storedHex, 'hex') : Buffer.alloc(0);
  const ok = stored.length === 32;
  return timingSafeEqual(given, ok ? stored : Buffer.alloc(32)) && ok;
}

/** One-time "set your password" links for owners of automatically created accounts. Only a hash of a token is stored. */
@Injectable()
export class ClaimService {
  /** Best-effort per-instance counter; the 256-bit payer secret is what really stops guessing. */
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly auto: AutoProvisionService,
  ) {}

  /** Mints a fresh link (older unused ones stop working). The raw token is returned once and never stored or logged. */
  async issue(userId: string, registrationId: string, businessId: string, issuedBy: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256hex(token);
    const expiresAt = new Date(now.getTime() + CLAIM_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.credentialToken.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await tx.credentialToken.create({ data: { userId, registrationId, businessId, tokenHash, expiresAt, issuedBy } });
      await this.audit.append(tx, { businessId, actor: { type: 'SYSTEM', label: 'claim-link' } }, {
        action: 'owner.claim_link_issued',
        resourceType: 'app_user',
        resourceId: userId,
        metadata: { registrationId, issuedBy, tokenRef: tokenHash.slice(0, 8) },
      });
    });
    return { token, expiresAt };
  }

  /** The payer's browser asks for the owner's link. Needs code + email + the secret from the "Pay now" response. */
  async issueForPayer(dto: ClaimIssueDto, now = new Date()): Promise<ClaimIssueAnswer> {
    if (this.blocked(dto.referenceCode, now)) throw new NotFoundError(CLAIM_NOT_FOUND);
    const reg = await this.prisma.registrationRequest.findUnique({ where: { referenceCode: dto.referenceCode } });
    const emailOk = timingSafeEqual(digest(dto.email), digest(reg?.email ?? ''));
    const payments = reg ? await this.prisma.registrationPayment.findMany({ where: { registrationId: reg.id } }) : [];
    const given = digest(dto.payerSecret);
    // Look at every row (no early exit) so timing does not reveal how many payments exist.
    let secretOk = false;
    for (const p of payments) secretOk = sameHash(given, p.payerSecretHash) || secretOk;
    if (!reg || !emailOk || !secretOk) {
      this.fail(dto.referenceCode, now);
      throw new NotFoundError(CLAIM_NOT_FOUND);
    }

    // Proof is good. Not paid in full yet, or the account is still being made: ask again shortly.
    if (!payments.some((p) => isAutoEligiblePayment(p))) return { status: 'pending' };
    let job = await this.prisma.registrationProvisioning.findUnique({ where: { registrationId: reg.id } });
    if (job?.status !== 'DONE') {
      await this.auto.autoProvision(reg.id, now);
      job = await this.prisma.registrationProvisioning.findUnique({ where: { registrationId: reg.id } });
    }
    if (job?.status !== 'DONE' || !job.businessId) return { status: 'pending' };

    const owner = await this.ownerOf(job.businessId, job.input as unknown as ProvisionInput);
    // The owner already signed in: this link would be a password reset for a live account. Staff handle that.
    if (!owner || owner.lastLoginAt) throw new NotFoundError(CLAIM_NOT_FOUND);
    const issued = await this.issue(owner.id, reg.id, job.businessId, 'customer', now);
    return { status: 'ready', token: issued.token, expiresAt: issued.expiresAt };
  }

  /** Staff: a new link for an account that exists and whose owner has not signed in yet. */
  async issueForStaff(actor: ActorContext, registrationId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
    const job = await this.prisma.registrationProvisioning.findUnique({ where: { registrationId } });
    if (!job || job.status !== 'DONE' || !job.businessId) {
      throw new ConflictError('The restaurant account is not created yet for this request.');
    }
    const owner = await this.ownerOf(job.businessId, job.input as unknown as ProvisionInput);
    if (!owner) throw new NotFoundError('The owner login was not found');
    if (owner.lastLoginAt) throw new ConflictError('The owner has already signed in. Use "reset password" on their account instead.');
    return this.issue(owner.id, registrationId, job.businessId, `staff:${actor.id ?? actor.label}`, now);
  }

  /** The owner chooses a password with the link. Works once; the link then dies. */
  async redeem(dto: ClaimRedeemDto, now = new Date()): Promise<{ email: string; businessName: string }> {
    const tokenHash = sha256hex(dto.token);
    const rec = await this.prisma.credentialToken.findUnique({ where: { tokenHash } });
    if (!rec || rec.usedAt || rec.revokedAt || rec.expiresAt.getTime() <= now.getTime()) throw new NotFoundError(CLAIM_LINK_INVALID);
    const user = await this.prisma.user.findUnique({ where: { id: rec.userId } });
    if (!user || user.status !== 'ACTIVE' || !user.businessId) throw new NotFoundError(CLAIM_LINK_INVALID);
    const businessId = user.businessId;
    const passwordHash = await this.passwords.hash(dto.password);

    await this.prisma.$transaction(async (tx) => {
      // Compare-and-set: of two requests with the same link, exactly one wins.
      const won = await tx.credentialToken.updateMany({
        where: { id: rec.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (won.count === 0) throw new NotFoundError(CLAIM_LINK_INVALID);
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false, failedAttempts: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now, revokedReason: 'password_set_via_claim' } });
      await this.audit.append(tx, { businessId, actor: { type: 'SYSTEM', label: 'claim-link' } }, {
        action: 'owner.password_set_via_claim',
        resourceType: 'app_user',
        resourceId: user.id,
        metadata: { tokenRef: tokenHash.slice(0, 8) },
      });
    });
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    logger.child({ businessId }).info('owner set a password with a claim link');
    return { email: user.email, businessName: biz?.name ?? '' };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private ownerOf(businessId: string, input: ProvisionInput) {
    const email = (input.ownerEmail ?? '').trim().toLowerCase();
    return this.prisma.user.findFirst({ where: { businessId, email } });
  }

  private blocked(code: string, now: Date): boolean {
    const f = this.failures.get(code);
    if (!f) return false;
    if (f.resetAt <= now.getTime()) {
      this.failures.delete(code);
      return false;
    }
    return f.count >= MAX_FAILURES;
  }

  private fail(code: string, now: Date): void {
    const f = this.failures.get(code);
    if (!f || f.resetAt <= now.getTime()) this.failures.set(code, { count: 1, resetAt: now.getTime() + FAILURE_WINDOW_MS });
    else f.count += 1;
    if (this.failures.size > 5000) this.failures.clear();
  }
}
