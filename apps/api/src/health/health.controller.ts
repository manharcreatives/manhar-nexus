import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { HEALTH_STATUS, type HealthReport } from '@nexus/shared';
import { HealthService } from './health.service';
import { logger } from '../logging/logger';
import { Public } from '../iam/principal';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    let report: HealthReport;
    try {
      report = await this.health.getReport();
    } catch (error) {
      logger.child({ err: error }).error('health report failed');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HEALTH_STATUS.ERROR,
        message: 'health report failure',
      });
      return;
    }
    const code =
      report.status === HEALTH_STATUS.ERROR ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
    res.status(code).json(report);
  }
}
