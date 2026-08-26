import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { DiningService } from './dining.service';
import {
  createDiningAreaSchema,
  updateDiningAreaSchema,
  createDiningTableSchema,
  updateDiningTableSchema,
  type CreateDiningAreaDto,
  type UpdateDiningAreaDto,
  type CreateDiningTableDto,
  type UpdateDiningTableDto,
} from './dining.dto';

@Controller('admin/dining/areas')
@RequireModule('restaurant')
export class DiningAreaController {
  constructor(private readonly dining: DiningService) {}

  @Get()
  @RequirePermission('restaurant.dining.view')
  list(@CurrentPrincipal() p: Principal, @Query('locationId', new ParseUUIDPipe({ optional: true })) locationId?: string) {
    return this.dining.listAreas(scopeFromPrincipal(p), locationId);
  }

  @Get(':id')
  @RequirePermission('restaurant.dining.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.dining.findAreaOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.dining.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createDiningAreaSchema)) dto: CreateDiningAreaDto,
  ) {
    return this.dining.createArea(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.dining.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateDiningAreaSchema)) dto: UpdateDiningAreaDto,
  ) {
    return this.dining.updateArea(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('restaurant.dining.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.dining.deleteArea(scopeFromPrincipal(p), id);
  }
}

@Controller('admin/dining/tables')
@RequireModule('restaurant')
export class DiningTableController {
  constructor(private readonly dining: DiningService) {}

  @Get()
  @RequirePermission('restaurant.dining.view')
  list(@CurrentPrincipal() p: Principal, @Query('areaId', new ParseUUIDPipe({ optional: true })) areaId?: string) {
    return this.dining.listTables(scopeFromPrincipal(p), areaId);
  }

  @Get(':id')
  @RequirePermission('restaurant.dining.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.dining.findTableOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.dining.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createDiningTableSchema)) dto: CreateDiningTableDto,
  ) {
    return this.dining.createTable(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.dining.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateDiningTableSchema)) dto: UpdateDiningTableDto,
  ) {
    return this.dining.updateTable(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('restaurant.dining.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.dining.deleteTable(scopeFromPrincipal(p), id);
  }
}
