import { Injectable } from '@nestjs/common';
import { Prisma, type TaxCategory, type CatalogCategory, type CatalogItem, type CatalogVariant, type ModifierGroup, type ModifierOption, type ProductionArea } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type {
  CreateTaxCategoryDto,
  UpdateTaxCategoryDto,
  CreateCatalogCategoryDto,
  UpdateCatalogCategoryDto,
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
  CreateCatalogVariantDto,
  UpdateCatalogVariantDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
  LinkModifierGroupDto,
  CreateProductionAreaDto,
  UpdateProductionAreaDto,
} from './catalog.dto';

@Injectable()
export class CatalogService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  // ── Tax Categories ────────────────────────────────────────────────────────────

  async listTaxCategories(scope: TenantScope): Promise<TaxCategory[]> {
    return this.prisma.taxCategory.findMany({
      where: this.scoped(scope),
      orderBy: { name: 'asc' },
    });
  }

  async findTaxCategoryOrThrow(scope: TenantScope, id: string): Promise<TaxCategory> {
    const row = await this.prisma.taxCategory.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Tax category not found', { id });
    return this.assertOwned(row, scope);
  }

  async createTaxCategory(scope: TenantScope, dto: CreateTaxCategoryDto): Promise<TaxCategory> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.taxCategory.create({
        data: {
          businessId: scope.businessId,
          name: dto.name,
          rate: dto.rate,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'tax_category.created',
        resourceType: 'tax_category',
        resourceId: row.id,
        metadata: { name: row.name, rate: Number(row.rate) },
      });
      return row;
    });
  }

  async updateTaxCategory(scope: TenantScope, id: string, dto: UpdateTaxCategoryDto): Promise<TaxCategory> {
    const existing = await this.findTaxCategoryOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Tax category was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.taxCategory.update({
        where: { id },
        data: {
          name: dto.name,
          rate: dto.rate,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'tax_category.updated',
        resourceType: 'tax_category',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteTaxCategory(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findTaxCategoryOrThrow(scope, id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.taxCategory.delete({ where: { id: existing.id } });
        await this.audit.append(tx, scope, {
          action: 'tax_category.deleted',
          resourceType: 'tax_category',
          resourceId: id,
          metadata: { name: existing.name },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictError('Tax category is referenced by catalog items and cannot be deleted', { id });
      }
      throw e;
    }
  }

  // ── Catalog Categories ─────────────────────────────────────────────────────────

  async listCategories(scope: TenantScope): Promise<CatalogCategory[]> {
    return this.prisma.catalogCategory.findMany({
      where: this.scoped(scope),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findCategoryOrThrow(scope: TenantScope, id: string): Promise<CatalogCategory> {
    const row = await this.prisma.catalogCategory.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Catalog category not found', { id });
    return this.assertOwned(row, scope);
  }

  async createCategory(scope: TenantScope, dto: CreateCatalogCategoryDto): Promise<CatalogCategory> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogCategory.create({
        data: {
          businessId: scope.businessId,
          name: dto.name,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_category.created',
        resourceType: 'catalog_category',
        resourceId: row.id,
        metadata: { name: row.name },
      });
      return row;
    });
  }

  async updateCategory(scope: TenantScope, id: string, dto: UpdateCatalogCategoryDto): Promise<CatalogCategory> {
    const existing = await this.findCategoryOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Catalog category was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogCategory.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description === undefined ? undefined : dto.description,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_category.updated',
        resourceType: 'catalog_category',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteCategory(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findCategoryOrThrow(scope, id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.catalogCategory.delete({ where: { id: existing.id } });
        await this.audit.append(tx, scope, {
          action: 'catalog_category.deleted',
          resourceType: 'catalog_category',
          resourceId: id,
          metadata: { name: existing.name },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictError('Catalog category is referenced by items and cannot be deleted', { id });
      }
      throw e;
    }
  }

  // ── Catalog Items ──────────────────────────────────────────────────────────────

  async listItems(scope: TenantScope, categoryId?: string): Promise<CatalogItem[]> {
    return this.prisma.catalogItem.findMany({
      where: this.scoped(scope, categoryId ? { categoryId } : undefined),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { variants: { orderBy: { sortOrder: 'asc' } }, modifierGroups: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findItemOrThrow(scope: TenantScope, id: string): Promise<CatalogItem> {
    const row = await this.prisma.catalogItem.findFirst({
      where: this.scoped(scope, { id }),
      include: { variants: { orderBy: { sortOrder: 'asc' } }, modifierGroups: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundError('Catalog item not found', { id });
    return this.assertOwned(row, scope);
  }

  async createItem(scope: TenantScope, dto: CreateCatalogItemDto): Promise<CatalogItem> {
    await this.assertCategoryInScope(scope, dto.categoryId);
    if (dto.taxCategoryId) await this.assertTaxCategoryInScope(scope, dto.taxCategoryId);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogItem.create({
        data: {
          businessId: scope.businessId,
          categoryId: dto.categoryId,
          taxCategoryId: dto.taxCategoryId ?? null,
          name: dto.name,
          description: dto.description ?? null,
          basePriceMinorUnits: dto.basePriceMinorUnits,
          isAvailable: dto.isAvailable,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
        include: { variants: true, modifierGroups: true },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_item.created',
        resourceType: 'catalog_item',
        resourceId: row.id,
        metadata: { name: row.name, categoryId: dto.categoryId },
      });
      return row;
    });
  }

  async updateItem(scope: TenantScope, id: string, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
    const existing = await this.findItemOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Catalog item was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    if (dto.categoryId) await this.assertCategoryInScope(scope, dto.categoryId);
    if (dto.taxCategoryId) await this.assertTaxCategoryInScope(scope, dto.taxCategoryId);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogItem.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          taxCategoryId: dto.taxCategoryId === undefined ? undefined : dto.taxCategoryId,
          name: dto.name,
          description: dto.description === undefined ? undefined : dto.description,
          basePriceMinorUnits: dto.basePriceMinorUnits,
          isAvailable: dto.isAvailable,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
          version: { increment: 1 },
        },
        include: { variants: true, modifierGroups: true },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_item.updated',
        resourceType: 'catalog_item',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteItem(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findItemOrThrow(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.delete({ where: { id: existing.id } });
      await this.audit.append(tx, scope, {
        action: 'catalog_item.deleted',
        resourceType: 'catalog_item',
        resourceId: id,
        metadata: { name: existing.name },
      });
    });
  }

  // ── Variants ───────────────────────────────────────────────────────────────────

  async createVariant(scope: TenantScope, itemId: string, dto: CreateCatalogVariantDto): Promise<CatalogVariant> {
    await this.findItemOrThrow(scope, itemId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogVariant.create({
        data: {
          catalogItemId: itemId,
          businessId: scope.businessId,
          name: dto.name,
          priceAdjMinorUnits: dto.priceAdjMinorUnits,
          isAvailable: dto.isAvailable,
          sortOrder: dto.sortOrder,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_variant.created',
        resourceType: 'catalog_variant',
        resourceId: row.id,
        metadata: { name: row.name, catalogItemId: itemId },
      });
      return row;
    });
  }

  async updateVariant(scope: TenantScope, itemId: string, variantId: string, dto: UpdateCatalogVariantDto): Promise<CatalogVariant> {
    const variant = await this.findVariantOrThrow(scope, itemId, variantId);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== variant.version) {
      throw new VersionConflictError('Variant was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: variant.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.catalogVariant.update({
        where: { id: variantId },
        data: {
          name: dto.name,
          priceAdjMinorUnits: dto.priceAdjMinorUnits,
          isAvailable: dto.isAvailable,
          sortOrder: dto.sortOrder,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_variant.updated',
        resourceType: 'catalog_variant',
        resourceId: variantId,
        metadata: { id: variantId },
      });
      return row;
    });
  }

  async deleteVariant(scope: TenantScope, itemId: string, variantId: string): Promise<void> {
    await this.findVariantOrThrow(scope, itemId, variantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogVariant.delete({ where: { id: variantId } });
      await this.audit.append(tx, scope, {
        action: 'catalog_variant.deleted',
        resourceType: 'catalog_variant',
        resourceId: variantId,
        metadata: { catalogItemId: itemId },
      });
    });
  }

  private async findVariantOrThrow(scope: TenantScope, itemId: string, variantId: string): Promise<CatalogVariant> {
    const row = await this.prisma.catalogVariant.findFirst({
      where: { id: variantId, catalogItemId: itemId, businessId: scope.businessId },
    });
    if (!row) throw new NotFoundError('Variant not found', { variantId, itemId });
    return this.assertOwned(row, scope);
  }

  // ── Modifier Groups ────────────────────────────────────────────────────────────

  async listModifierGroups(scope: TenantScope): Promise<ModifierGroup[]> {
    return this.prisma.modifierGroup.findMany({
      where: this.scoped(scope),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findModifierGroupOrThrow(scope: TenantScope, id: string): Promise<ModifierGroup> {
    const row = await this.prisma.modifierGroup.findFirst({
      where: this.scoped(scope, { id }),
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundError('Modifier group not found', { id });
    return this.assertOwned(row, scope);
  }

  async createModifierGroup(scope: TenantScope, dto: CreateModifierGroupDto): Promise<ModifierGroup> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.modifierGroup.create({
        data: {
          businessId: scope.businessId,
          name: dto.name,
          selectionType: dto.selectionType,
          isRequired: dto.isRequired,
          minSelections: dto.minSelections,
          maxSelections: dto.maxSelections ?? null,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
        },
        include: { options: true },
      });
      await this.audit.append(tx, scope, {
        action: 'modifier_group.created',
        resourceType: 'modifier_group',
        resourceId: row.id,
        metadata: { name: row.name },
      });
      return row;
    });
  }

  async updateModifierGroup(scope: TenantScope, id: string, dto: UpdateModifierGroupDto): Promise<ModifierGroup> {
    const existing = await this.findModifierGroupOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Modifier group was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.modifierGroup.update({
        where: { id },
        data: {
          name: dto.name,
          selectionType: dto.selectionType,
          isRequired: dto.isRequired,
          minSelections: dto.minSelections,
          maxSelections: dto.maxSelections === undefined ? undefined : dto.maxSelections,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
          version: { increment: 1 },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      await this.audit.append(tx, scope, {
        action: 'modifier_group.updated',
        resourceType: 'modifier_group',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteModifierGroup(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findModifierGroupOrThrow(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.modifierGroup.delete({ where: { id: existing.id } });
      await this.audit.append(tx, scope, {
        action: 'modifier_group.deleted',
        resourceType: 'modifier_group',
        resourceId: id,
        metadata: { name: existing.name },
      });
    });
  }

  // ── Modifier Options ───────────────────────────────────────────────────────────

  async createModifierOption(scope: TenantScope, groupId: string, dto: CreateModifierOptionDto): Promise<ModifierOption> {
    await this.findModifierGroupOrThrow(scope, groupId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.modifierOption.create({
        data: {
          modifierGroupId: groupId,
          businessId: scope.businessId,
          name: dto.name,
          priceAdjMinorUnits: dto.priceAdjMinorUnits,
          isDefault: dto.isDefault,
          isAvailable: dto.isAvailable,
          sortOrder: dto.sortOrder,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'modifier_option.created',
        resourceType: 'modifier_option',
        resourceId: row.id,
        metadata: { name: row.name, modifierGroupId: groupId },
      });
      return row;
    });
  }

  async updateModifierOption(scope: TenantScope, groupId: string, optionId: string, dto: UpdateModifierOptionDto): Promise<ModifierOption> {
    const option = await this.findModifierOptionOrThrow(scope, groupId, optionId);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== option.version) {
      throw new VersionConflictError('Modifier option was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: option.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.modifierOption.update({
        where: { id: optionId },
        data: {
          name: dto.name,
          priceAdjMinorUnits: dto.priceAdjMinorUnits,
          isDefault: dto.isDefault,
          isAvailable: dto.isAvailable,
          sortOrder: dto.sortOrder,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'modifier_option.updated',
        resourceType: 'modifier_option',
        resourceId: optionId,
        metadata: { id: optionId },
      });
      return row;
    });
  }

  async deleteModifierOption(scope: TenantScope, groupId: string, optionId: string): Promise<void> {
    await this.findModifierOptionOrThrow(scope, groupId, optionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.modifierOption.delete({ where: { id: optionId } });
      await this.audit.append(tx, scope, {
        action: 'modifier_option.deleted',
        resourceType: 'modifier_option',
        resourceId: optionId,
        metadata: { modifierGroupId: groupId },
      });
    });
  }

  private async findModifierOptionOrThrow(scope: TenantScope, groupId: string, optionId: string): Promise<ModifierOption> {
    const row = await this.prisma.modifierOption.findFirst({
      where: { id: optionId, modifierGroupId: groupId, businessId: scope.businessId },
    });
    if (!row) throw new NotFoundError('Modifier option not found', { optionId, groupId });
    return this.assertOwned(row, scope);
  }

  // ── Item ↔ ModifierGroup links ─────────────────────────────────────────────────

  async linkModifierGroup(scope: TenantScope, itemId: string, dto: LinkModifierGroupDto): Promise<void> {
    await this.findItemOrThrow(scope, itemId);
    await this.findModifierGroupOrThrow(scope, dto.modifierGroupId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.catalogItemModifierGroup.create({
          data: { catalogItemId: itemId, modifierGroupId: dto.modifierGroupId, sortOrder: dto.sortOrder },
        });
        await this.audit.append(tx, scope, {
          action: 'catalog_item.modifier_group_linked',
          resourceType: 'catalog_item',
          resourceId: itemId,
          metadata: { modifierGroupId: dto.modifierGroupId },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictError('Modifier group is already linked to this item', {
          itemId,
          modifierGroupId: dto.modifierGroupId,
        });
      }
      throw e;
    }
  }

  async unlinkModifierGroup(scope: TenantScope, itemId: string, modifierGroupId: string): Promise<void> {
    await this.findItemOrThrow(scope, itemId);
    await this.findModifierGroupOrThrow(scope, modifierGroupId);
    const link = await this.prisma.catalogItemModifierGroup.findUnique({
      where: { catalogItemId_modifierGroupId: { catalogItemId: itemId, modifierGroupId } },
    });
    if (!link) throw new NotFoundError('Modifier group is not linked to this item', { itemId, modifierGroupId });
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItemModifierGroup.delete({
        where: { catalogItemId_modifierGroupId: { catalogItemId: itemId, modifierGroupId } },
      });
      await this.audit.append(tx, scope, {
        action: 'catalog_item.modifier_group_unlinked',
        resourceType: 'catalog_item',
        resourceId: itemId,
        metadata: { modifierGroupId },
      });
    });
  }

  // ── Production Areas ───────────────────────────────────────────────────────────

  async listProductionAreas(scope: TenantScope, locationId?: string): Promise<ProductionArea[]> {
    return this.prisma.productionArea.findMany({
      where: this.scoped(scope, locationId ? { locationId } : {}),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findProductionAreaOrThrow(scope: TenantScope, id: string): Promise<ProductionArea> {
    const row = await this.prisma.productionArea.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Production area not found', { id });
    return this.assertOwned(row, scope);
  }

  async createProductionArea(scope: TenantScope, dto: CreateProductionAreaDto): Promise<ProductionArea> {
    await this.assertLocationInScope(scope, dto.locationId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productionArea.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId,
          name: dto.name,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'production_area.created',
        resourceType: 'production_area',
        resourceId: row.id,
        locationId: dto.locationId,
        metadata: { name: row.name },
      });
      return row;
    });
  }

  async updateProductionArea(scope: TenantScope, id: string, dto: UpdateProductionAreaDto): Promise<ProductionArea> {
    const existing = await this.findProductionAreaOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Production area was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productionArea.update({
        where: { id },
        data: { name: dto.name, isActive: dto.isActive, sortOrder: dto.sortOrder, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, {
        action: 'production_area.updated',
        resourceType: 'production_area',
        resourceId: id,
        locationId: existing.locationId,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteProductionArea(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findProductionAreaOrThrow(scope, id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productionArea.delete({ where: { id } });
        await this.audit.append(tx, scope, {
          action: 'production_area.deleted',
          resourceType: 'production_area',
          resourceId: id,
          locationId: existing.locationId,
          metadata: { name: existing.name },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictError('Production area is in use by catalog items and cannot be deleted', { id });
      }
      throw e;
    }
  }

  // ── Cross-reference helpers ─────────────────────────────────────────────────────

  private async assertCategoryInScope(scope: TenantScope, categoryId: string): Promise<void> {
    const row = await this.prisma.catalogCategory.findFirst({
      where: this.scoped(scope, { id: categoryId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Category not found in this business', { categoryId });
  }

  private async assertTaxCategoryInScope(scope: TenantScope, taxCategoryId: string): Promise<void> {
    const row = await this.prisma.taxCategory.findFirst({
      where: this.scoped(scope, { id: taxCategoryId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Tax category not found in this business', { taxCategoryId });
  }
}
