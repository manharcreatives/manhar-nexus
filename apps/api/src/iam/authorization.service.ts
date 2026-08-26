import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EffectiveAuthz {
  /** Union of permission keys across the user's roles (may contain '*'). */
  permissions: Set<string>;
  allLocations: boolean;
  locationIds: Set<string>;
}

/**
 * Computes a user's effective authorization from their role assignments.
 * Resolved per-request (never embedded in the access token) so a permission or
 * role change takes effect on the very next request (≤60s revocation, ADR-004).
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<EffectiveAuthz> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: true } }, locations: true },
    });

    const permissions = new Set<string>();
    let allLocations = false;
    const locationIds = new Set<string>();

    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) permissions.add(rp.permissionKey);
      if (ur.allLocations) {
        allLocations = true;
      } else {
        for (const loc of ur.locations) locationIds.add(loc.locationId);
      }
    }

    return { permissions, allLocations, locationIds };
  }
}
