import { createHash, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers } from '@nestjs/common';
import { DomainError, UnauthorizedError } from '../common/errors';
import { Public } from '../iam/principal';
import { AutoProvisionService } from './auto-provision.service';

class CronNotConfiguredError extends DomainError {
  readonly code = 'CRON_NOT_CONFIGURED';
  readonly httpStatus = 503;
}

const digest = (v: string): Buffer => createHash('sha256').update(v).digest();

/**
 * Vercel Cron calls this every few minutes with `Authorization: Bearer $CRON_SECRET`. It finishes accounts that were
 * paid for but not created (a late webhook, a crashed run). The secret is the only credential, so unset means off.
 */
@Controller('internal/cron')
@Public()
export class CronController {
  constructor(private readonly auto: AutoProvisionService) {}

  @Get('provision')
  async provision(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new CronNotConfiguredError('CRON_SECRET is not set on this server.');
    const given = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!timingSafeEqual(digest(given), digest(secret))) throw new UnauthorizedError('Invalid cron credentials');
    return this.auto.runPending(3);
  }
}
