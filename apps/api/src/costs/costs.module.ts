import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { CostsService } from './costs.service';
import { CostsController } from './costs.controller';

@Module({
  imports: [CoreModule],
  controllers: [CostsController],
  providers: [CostsService],
})
export class CostsModule {}
