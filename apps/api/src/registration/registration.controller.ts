import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { zodBody, zodQuery } from '../common/zod-validation.pipe';
import { Public, RequirePermission } from '../iam/principal';
import {
  createRegistrationSchema,
  listRegistrationsQuerySchema,
  updateRegistrationSchema,
  type CreateRegistrationDto,
  type ListRegistrationsQuery,
  type RegistrationAck,
  type UpdateRegistrationDto,
} from './registration.dto';
import { registrationRateLimit, registrationRateTtlMs } from './registration.limits';
import { RegistrationService } from './registration.service';

/**
 * Landing-page lead capture (ADR-033). Unauthenticated by design; it only stores a
 * request for staff to review and never provisions anything.
 */
@Controller('public/registrations')
@Public()
export class RegistrationPublicController {
  constructor(private readonly registrations: RegistrationService) {}

  /**
   * Tight per-IP throttle (default 5 per hour) on top of the coarse /auth default.
   * The resolvers run per request so the limits can be tuned (and tested) via env
   * without rebuilding the decorator metadata.
   */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: () => registrationRateLimit(), ttl: () => registrationRateTtlMs() } })
  @HttpCode(202)
  submit(
    @Body(zodBody(createRegistrationSchema)) dto: CreateRegistrationDto,
    @Req() req: Request,
  ): Promise<RegistrationAck> {
    return this.registrations.submit(dto, { ip: req.ip, userAgent: req.header('user-agent') });
  }
}

/** Platform-only (Manhar staff): review and triage incoming requests. */
@Controller('internal/registrations')
export class RegistrationAdminController {
  constructor(private readonly registrations: RegistrationService) {}

  @Get()
  @RequirePermission('platform.registration.view')
  list(@Query(zodQuery(listRegistrationsQuerySchema)) query: ListRegistrationsQuery) {
    return this.registrations.list(query);
  }

  @Get(':id')
  @RequirePermission('platform.registration.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.get(id);
  }

  @Patch(':id')
  @RequirePermission('platform.registration.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateRegistrationSchema)) dto: UpdateRegistrationDto,
  ) {
    return this.registrations.update(id, dto);
  }
}
