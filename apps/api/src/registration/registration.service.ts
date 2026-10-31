import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RegistrationStatus, type RegistrationRequest } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import { DEV_REGISTRATION_IP_SALT } from '../config/configuration';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import {
  MIN_FILL_MS,
  REGISTRATION_TRANSITIONS,
  type CreateRegistrationDto,
  type ListRegistrationsQuery,
  type RegistrationAck,
  type RegistrationStatusKey,
  type UpdateRegistrationDto,
} from './registration.dto';
import { generateReferenceCode, hashIp, truncateUserAgent } from './registration.util';

/** DB-backed abuse caps. The throttler is per-process memory; these hold across instances. */
export const IP_HOURLY_CAP = 5;
export const EMAIL_DAILY_CAP = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const REFERENCE_RETRIES = 5;

export interface SubmitMeta {
  ip: string | undefined;
  userAgent: string | undefined;
}

/** Staff-facing projection: everything except the (pseudonymous) ipHash. */
export type RegistrationView = Omit<RegistrationRequest, 'ipHash'>;

function toView(row: RegistrationRequest): RegistrationView {
  const { ipHash: _ipHash, ...view } = row;
  return view;
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  /**
   * Accepts a lead from the unauthenticated landing form.
   *
   * Every non-validation outcome (stored, spam, capped, duplicate) returns the SAME
   * acknowledgement shape so the endpoint teaches bots and enumerators nothing. The
   * response never echoes input. Nothing here creates a tenant, a user or a charge.
   * Logs carry the reference code and an outcome label only, never PII.
   */
  async submit(dto: CreateRegistrationDto, meta: SubmitMeta, now = new Date()): Promise<RegistrationAck> {
    const ipHash = hashIp(meta.ip, this.ipSalt());
    const userAgent = truncateUserAgent(meta.userAgent);
    const email = dto.email; // already trimmed + lower-cased by the schema

    // Abuse caps first: a capped request is dropped (not stored) so one source cannot
    // grow the table without bound, spam rows included.
    const capReason = await this.capReason(ipHash, email, now);
    if (capReason) {
      const referenceCode = generateReferenceCode();
      logger.child({ reference: referenceCode }).warn(`registration dropped: ${capReason}`);
      return { ok: true, referenceCode };
    }

    const spamReason = this.spamReason(dto, now);
    const status: RegistrationStatus = spamReason ? RegistrationStatus.SPAM : RegistrationStatus.NEW;

    const row = await this.createWithUniqueReference({
      status,
      restaurantName: dto.restaurantName,
      contactName: dto.contactName,
      email,
      phone: dto.phone,
      city: dto.city,
      businessKind: dto.businessKind,
      outlets: dto.outlets,
      planKey: dto.planKey,
      billingCycle: dto.billingCycle,
      message: dto.message && dto.message !== '' ? dto.message : null,
      consentVersion: dto.consentVersion,
      consentAt: now,
      ipHash,
      userAgent,
      internalNotes: spamReason ? `auto: ${spamReason}` : null,
    });

    logger
      .child({ reference: row.referenceCode, registrationId: row.id })
      .info(spamReason ? `registration stored as SPAM: ${spamReason}` : 'registration received');
    return { ok: true, referenceCode: row.referenceCode };
  }

  /** Honeypot filled, or the form was "completed" faster than a human can. */
  private spamReason(dto: CreateRegistrationDto, now: Date): string | null {
    if (dto.website !== undefined && dto.website.trim() !== '') return 'honeypot';
    if (dto.startedAt !== undefined && now.getTime() - dto.startedAt < MIN_FILL_MS) return 'time-trap';
    return null;
  }

  private async capReason(ipHash: string | null, email: string, now: Date): Promise<string | null> {
    if (ipHash) {
      const perIp = await this.prisma.registrationRequest.count({
        where: { ipHash, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
      });
      if (perIp >= IP_HOURLY_CAP) return 'ip-cap';
    }
    // SPAM rows do not count toward the email cap, so a bot cannot lock a real
    // person's address out by submitting it through the honeypot.
    const perEmail = await this.prisma.registrationRequest.count({
      where: {
        email,
        status: { not: RegistrationStatus.SPAM },
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
    });
    return perEmail >= EMAIL_DAILY_CAP ? 'email-cap' : null;
  }

  private async createWithUniqueReference(
    data: Omit<Prisma.RegistrationRequestUncheckedCreateInput, 'referenceCode'>,
  ): Promise<RegistrationRequest> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.registrationRequest.create({
          data: { ...data, referenceCode: generateReferenceCode() },
        });
      } catch (err) {
        const isCodeCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          String((err.meta as { target?: unknown } | undefined)?.target ?? '').includes('referenceCode');
        if (!isCodeCollision || attempt >= REFERENCE_RETRIES) throw err;
      }
    }
  }

  private ipSalt(): string {
    return this.config.get<string>('REGISTRATION_IP_SALT', DEV_REGISTRATION_IP_SALT);
  }

  // ── Platform (internal/registrations) ───────────────────────────────────────

  async list(query: ListRegistrationsQuery) {
    const where: Prisma.RegistrationRequestWhereInput = query.status ? { status: query.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.registrationRequest.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.registrationRequest.count({ where }),
    ]);
    return { items: rows.map(toView), total, skip: query.skip, take: query.take };
  }

  async get(id: string): Promise<RegistrationView> {
    return toView(await this.findOrThrow(id));
  }

  async update(id: string, dto: UpdateRegistrationDto): Promise<RegistrationView> {
    const existing = await this.findOrThrow(id);
    const nextStatus = (dto.status ?? existing.status) as RegistrationStatusKey;

    if (dto.status && dto.status !== existing.status) {
      const allowed = REGISTRATION_TRANSITIONS[existing.status as RegistrationStatusKey];
      if (!allowed.includes(dto.status)) {
        throw new ValidationError(`Cannot move a ${existing.status} request to ${dto.status}`, {
          from: existing.status,
          to: dto.status,
          allowed,
        });
      }
    }
    if (dto.businessId && nextStatus !== 'CONVERTED') {
      throw new ValidationError('businessId can only be set on a CONVERTED request');
    }
    if (dto.businessId) {
      const business = await this.prisma.business.findUnique({
        where: { id: dto.businessId },
        select: { id: true },
      });
      if (!business) throw new NotFoundError('Business not found');
    }

    // Compare-and-set on the status we validated against: two staff members racing
    // cannot both apply conflicting transitions.
    const res = await this.prisma.registrationRequest.updateMany({
      where: { id, status: existing.status },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assignedTo !== undefined ? { assignedTo: dto.assignedTo } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes } : {}),
        ...(dto.businessId !== undefined ? { businessId: dto.businessId } : {}),
        updatedAt: new Date(),
      },
    });
    if (res.count === 0) {
      throw new ConflictError('This request was changed by someone else. Reload and try again.');
    }
    logger.child({ reference: existing.referenceCode, registrationId: id }).info(
      `registration updated${dto.status ? `: ${existing.status} -> ${dto.status}` : ''}`,
    );
    return this.get(id);
  }

  private async findOrThrow(id: string): Promise<RegistrationRequest> {
    const row = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Registration request not found');
    return row;
  }
}
