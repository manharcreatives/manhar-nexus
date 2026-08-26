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
import { CatalogService } from './catalog.service';
import {
  createTaxCategorySchema,
  updateTaxCategorySchema,
  createCatalogCategorySchema,
  updateCatalogCategorySchema,
  createCatalogItemSchema,
  updateCatalogItemSchema,
  createCatalogVariantSchema,
  updateCatalogVariantSchema,
  createModifierGroupSchema,
  updateModifierGroupSchema,
  createModifierOptionSchema,
  updateModifierOptionSchema,
  linkModifierGroupSchema,
  createProductionAreaSchema,
  updateProductionAreaSchema,
  type CreateTaxCategoryDto,
  type UpdateTaxCategoryDto,
  type CreateCatalogCategoryDto,
  type UpdateCatalogCategoryDto,
  type CreateCatalogItemDto,
  type UpdateCatalogItemDto,
  type CreateCatalogVariantDto,
  type UpdateCatalogVariantDto,
  type CreateModifierGroupDto,
  type UpdateModifierGroupDto,
  type CreateModifierOptionDto,
  type UpdateModifierOptionDto,
  type LinkModifierGroupDto,
  type CreateProductionAreaDto,
  type UpdateProductionAreaDto,
} from './catalog.dto';

// ── Tax Categories ─────────────────────────────────────────────────────────────

@Controller('admin/catalog/tax-categories')
@RequireModule('catalog')
export class TaxCategoryController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('catalog.taxcategory.view')
  list(@CurrentPrincipal() p: Principal) {
    return this.catalog.listTaxCategories(scopeFromPrincipal(p));
  }

  @Get(':id')
  @RequirePermission('catalog.taxcategory.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findTaxCategoryOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('catalog.taxcategory.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createTaxCategorySchema)) dto: CreateTaxCategoryDto,
  ) {
    return this.catalog.createTaxCategory(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.taxcategory.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateTaxCategorySchema)) dto: UpdateTaxCategoryDto,
  ) {
    return this.catalog.updateTaxCategory(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.taxcategory.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteTaxCategory(scopeFromPrincipal(p), id);
  }
}

// ── Catalog Categories ─────────────────────────────────────────────────────────

@Controller('admin/catalog/categories')
@RequireModule('catalog')
export class CatalogCategoryController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('catalog.category.view')
  list(@CurrentPrincipal() p: Principal) {
    return this.catalog.listCategories(scopeFromPrincipal(p));
  }

  @Get(':id')
  @RequirePermission('catalog.category.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findCategoryOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('catalog.category.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createCatalogCategorySchema)) dto: CreateCatalogCategoryDto,
  ) {
    return this.catalog.createCategory(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.category.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateCatalogCategorySchema)) dto: UpdateCatalogCategoryDto,
  ) {
    return this.catalog.updateCategory(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.category.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteCategory(scopeFromPrincipal(p), id);
  }
}

// ── Catalog Items ──────────────────────────────────────────────────────────────

@Controller('admin/catalog/items')
@RequireModule('catalog')
export class CatalogItemController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('catalog.item.view')
  list(@CurrentPrincipal() p: Principal, @Query('categoryId', new ParseUUIDPipe({ optional: true })) categoryId?: string) {
    return this.catalog.listItems(scopeFromPrincipal(p), categoryId);
  }

  @Get(':id')
  @RequirePermission('catalog.item.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findItemOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('catalog.item.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createCatalogItemSchema)) dto: CreateCatalogItemDto,
  ) {
    return this.catalog.createItem(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.item.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateCatalogItemSchema)) dto: UpdateCatalogItemDto,
  ) {
    return this.catalog.updateItem(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.item.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteItem(scopeFromPrincipal(p), id);
  }

  // Variants

  @Post(':id/variants')
  @RequirePermission('catalog.variant.manage')
  addVariant(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(createCatalogVariantSchema)) dto: CreateCatalogVariantDto,
  ) {
    return this.catalog.createVariant(scopeFromPrincipal(p), id, dto);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermission('catalog.variant.manage')
  updateVariant(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body(zodBody(updateCatalogVariantSchema)) dto: UpdateCatalogVariantDto,
  ) {
    return this.catalog.updateVariant(scopeFromPrincipal(p), id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermission('catalog.variant.manage')
  @HttpCode(204)
  async removeVariant(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    await this.catalog.deleteVariant(scopeFromPrincipal(p), id, variantId);
  }

  // Modifier group links

  @Post(':id/modifier-groups')
  @RequirePermission('catalog.item.manage')
  @HttpCode(201)
  linkModifierGroup(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(linkModifierGroupSchema)) dto: LinkModifierGroupDto,
  ) {
    return this.catalog.linkModifierGroup(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id/modifier-groups/:modifierGroupId')
  @RequirePermission('catalog.item.manage')
  @HttpCode(204)
  async unlinkModifierGroup(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('modifierGroupId', ParseUUIDPipe) modifierGroupId: string,
  ) {
    await this.catalog.unlinkModifierGroup(scopeFromPrincipal(p), id, modifierGroupId);
  }
}

// ── Modifier Groups ────────────────────────────────────────────────────────────

@Controller('admin/catalog/modifier-groups')
@RequireModule('catalog')
export class ModifierGroupController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('catalog.modifier.view')
  list(@CurrentPrincipal() p: Principal) {
    return this.catalog.listModifierGroups(scopeFromPrincipal(p));
  }

  @Get(':id')
  @RequirePermission('catalog.modifier.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findModifierGroupOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('catalog.modifier.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createModifierGroupSchema)) dto: CreateModifierGroupDto,
  ) {
    return this.catalog.createModifierGroup(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.modifier.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateModifierGroupSchema)) dto: UpdateModifierGroupDto,
  ) {
    return this.catalog.updateModifierGroup(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.modifier.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteModifierGroup(scopeFromPrincipal(p), id);
  }

  // Options

  @Post(':id/options')
  @RequirePermission('catalog.modifier.manage')
  addOption(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(createModifierOptionSchema)) dto: CreateModifierOptionDto,
  ) {
    return this.catalog.createModifierOption(scopeFromPrincipal(p), id, dto);
  }

  @Patch(':id/options/:optionId')
  @RequirePermission('catalog.modifier.manage')
  updateOption(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body(zodBody(updateModifierOptionSchema)) dto: UpdateModifierOptionDto,
  ) {
    return this.catalog.updateModifierOption(scopeFromPrincipal(p), id, optionId, dto);
  }

  @Delete(':id/options/:optionId')
  @RequirePermission('catalog.modifier.manage')
  @HttpCode(204)
  async removeOption(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
  ) {
    await this.catalog.deleteModifierOption(scopeFromPrincipal(p), id, optionId);
  }
}

// ── Production Areas ───────────────────────────────────────────────────────────

@Controller('admin/catalog/production-areas')
@RequireModule('restaurant')
export class ProductionAreaController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('restaurant.production.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('locationId', new ParseUUIDPipe({ optional: true })) locationId?: string,
  ) {
    return this.catalog.listProductionAreas(scopeFromPrincipal(p), locationId);
  }

  @Get(':id')
  @RequirePermission('restaurant.production.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findProductionAreaOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.production.manage')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createProductionAreaSchema)) dto: CreateProductionAreaDto) {
    return this.catalog.createProductionArea(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.production.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateProductionAreaSchema)) dto: UpdateProductionAreaDto,
  ) {
    return this.catalog.updateProductionArea(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('restaurant.production.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteProductionArea(scopeFromPrincipal(p), id);
  }
}
