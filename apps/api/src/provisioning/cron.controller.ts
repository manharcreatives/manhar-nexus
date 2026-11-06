import { createHash, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers } from '@nestjs/common';
import { DomainError, UnauthorizedError } from '../common/errors';
import { Public } from '../iam/principal';
import { logger } from '../logging/logger';
import { AutoProvisionService } from './auto-provision.service';

class CronNotConfiguredError extends DomainError {
  readonly code = 'CRON_NOT_CONFIGURED';
  readonly httpStatus = 503;
}

export const MIN_SECRET_LENGTH = 32;

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
    // A short secret can be guessed over time: refuse to run at all rather than accept a weak credential.
    if (secret.length < MIN_SECRET_LENGTH) {
      logger.child({ cron: 'provision' }).error('CRON_SECRET is shorter than ' + MIN_SECRET_LENGTH + ' characters; the cron route is disabled. Generate one with: openssl rand -base64 32');
      throw new CronNotConfiguredError('CRON_SECRET is too short; the cron route is disabled.');
    }
    const given = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!timingSafeEqual(digest(given), digest(secret))) throw new UnauthorizedError('Invalid cron credentials');
    return this.auto.runPending(3);
  }
}
