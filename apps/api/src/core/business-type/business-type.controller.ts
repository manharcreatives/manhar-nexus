import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../iam/principal';
import { BusinessTypeService } from './business-type.service';

/** Read the global vertical catalog used when creating businesses. */
@Controller('internal/business-types')
export class BusinessTypeController {
  constructor(private readonly businessTypes: BusinessTypeService) {}

  @Get()
  @RequirePermission('platform.business.view')
  list() {
    return this.businessTypes.listActive();
  }
}
