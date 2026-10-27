import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RealtimeBus } from './realtime.bus';
import { RealtimeController } from './realtime.controller';
import { RealtimeInterceptor } from './realtime.interceptor';
import { RealtimeStreams } from './realtime.streams';

/** Realtime change notifications over SSE (ADR-032). Global so any service can inject RealtimeBus. */
@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeBus, RealtimeStreams, { provide: APP_INTERCEPTOR, useClass: RealtimeInterceptor }],
  exports: [RealtimeBus],
})
export class RealtimeModule {}
