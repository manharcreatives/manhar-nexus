import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import {
  HealthService,
  DEPENDENCY_PROBES,
  createDefaultProbes,
} from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: DEPENDENCY_PROBES,
      useFactory: (prisma: PrismaService, config: ConfigService) =>
        createDefaultProbes(prisma, config),
      inject: [PrismaService, ConfigService],
    },
  ],
})
export class HealthModule {}
