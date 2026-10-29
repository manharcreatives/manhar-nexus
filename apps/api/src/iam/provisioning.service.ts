import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../core/audit/audit.service';
import { BusinessService } from '../core/business/business.service';
import { PasswordService } from './password.service';
import { ConflictError, NotFoundError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import type { UserView } from './user.service';

export interface ProvisionBusinessInput {
  /** Email for the first business owner account. */
  email: string;
  displayName: string;
  password: string;
  /** Mark the password as temporary: the owner must change it at first sign-in. */
  requirePasswordChange?: boolean;
}

export interface ProvisionResult {
  owner: UserView;
}

/**
 * Idempotent provisioning: create the first BUSINESS-realm owner for a new
 * tenant. Called by a PLATFORM admin after creating the business. Fails with
 * 409 if an owner already exists (safe to retry once no owners exist).
 */
@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly businessService: BusinessService,
  ) {}

  async provisionOwner(
    actor: ActorContext,
    businessId: string,
    input: ProvisionBusinessInput,
  ): Promise<ProvisionResult> {
    // Verify business exists.
    await this.businessService.findByIdOrThrow(businessId);

    // Check uniqueness of email globally (business users share the same email namespace).
    const emailLower = input.email.trim().toLowerCase();
    const existingEmail = await this.prisma.user.findFirst({ where: { email: emailLower } });
    if (existingEmail) {
      throw new ConflictError('Email already registered', { email: emailLower });
    }

    // Guard: don't provision a second owner if one already exists.
    const ownerRole = await this.prisma.role.findFirst({ where: { key: 'owner', businessId: null } });
    if (!ownerRole) throw new NotFoundError('System owner role not found — run seed first', {});

    const existingOwner = await this.prisma.userRole.findFirst({
      where: { businessId, roleId: ownerRole.id },
    });
    if (existingOwner) {
      throw new ConflictError('Business already has an owner account', { businessId });
    }

    const passwordHash = await this.passwords.hash(input.password);

    const owner = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          realm: 'BUSINESS',
          businessId,
          email: emailLower,
          passwordHash,
          mustChangePassword: input.requirePasswordChange ?? false,
          displayName: input.displayName,
          status: 'ACTIVE',
        },
      });
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
          businessId,
          allLocations: true,
        },
      });
      await this.audit.append(tx, { businessId, actor }, {
        action: 'business.provisioned',
        resourceType: 'app_user',
        resourceId: user.id,
        metadata: { email: emailLower, displayName: input.displayName, role: 'owner' },
      });
      return user;
    });

    return {
      owner: {
        id: owner.id,
        email: owner.email,
        displayName: owner.displayName,
        realm: owner.realm,
        businessId: owner.businessId,
        status: owner.status,
        createdAt: owner.createdAt,
      },
    };
  }
}
