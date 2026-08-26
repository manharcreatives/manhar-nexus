import { z } from 'zod';

// ── Tax Category ───────────────────────────────────────────────────────────────

export const createTaxCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    rate: z.number().min(0).max(1),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateTaxCategoryDto = z.infer<typeof createTaxCategorySchema>;

export const updateTaxCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    rate: z.number().min(0).max(1).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateTaxCategoryDto = z.infer<typeof updateTaxCategorySchema>;

// ── Catalog Category ───────────────────────────────────────────────────────────

export const createCatalogCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateCatalogCategoryDto = z.infer<typeof createCatalogCategorySchema>;

export const updateCatalogCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateCatalogCategoryDto = z.infer<typeof updateCatalogCategorySchema>;

// ── Catalog Item ───────────────────────────────────────────────────────────────

export const createCatalogItemSchema = z
  .object({
    categoryId: z.string().uuid(),
    taxCategoryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    basePriceMinorUnits: z.number().int().min(0).default(0),
    isAvailable: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export type CreateCatalogItemDto = z.infer<typeof createCatalogItemSchema>;

export const updateCatalogItemSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    taxCategoryId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    basePriceMinorUnits: z.number().int().min(0).optional(),
    isAvailable: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateCatalogItemDto = z.infer<typeof updateCatalogItemSchema>;

// ── Catalog Variant ────────────────────────────────────────────────────────────

export const createCatalogVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    priceAdjMinorUnits: z.number().int().default(0),
    isAvailable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export type CreateCatalogVariantDto = z.infer<typeof createCatalogVariantSchema>;

export const updateCatalogVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    priceAdjMinorUnits: z.number().int().optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateCatalogVariantDto = z.infer<typeof updateCatalogVariantSchema>;

// ── Modifier Group ─────────────────────────────────────────────────────────────

export const createModifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    selectionType: z.enum(['SINGLE', 'MULTIPLE']).default('SINGLE'),
    isRequired: z.boolean().default(false),
    minSelections: z.number().int().min(0).default(0),
    maxSelections: z.number().int().min(1).nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateModifierGroupDto = z.infer<typeof createModifierGroupSchema>;

export const updateModifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    selectionType: z.enum(['SINGLE', 'MULTIPLE']).optional(),
    isRequired: z.boolean().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateModifierGroupDto = z.infer<typeof updateModifierGroupSchema>;

// ── Modifier Option ────────────────────────────────────────────────────────────

export const createModifierOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    priceAdjMinorUnits: z.number().int().default(0),
    isDefault: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export type CreateModifierOptionDto = z.infer<typeof createModifierOptionSchema>;

export const updateModifierOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    priceAdjMinorUnits: z.number().int().optional(),
    isDefault: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateModifierOptionDto = z.infer<typeof updateModifierOptionSchema>;

// ── Item ↔ ModifierGroup link ──────────────────────────────────────────────────

export const linkModifierGroupSchema = z
  .object({
    modifierGroupId: z.string().uuid(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export type LinkModifierGroupDto = z.infer<typeof linkModifierGroupSchema>;

// ── Production Area ────────────────────────────────────────────────────────────

export const createProductionAreaSchema = z
  .object({
    locationId: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export type CreateProductionAreaDto = z.infer<typeof createProductionAreaSchema>;

export const updateProductionAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateProductionAreaDto = z.infer<typeof updateProductionAreaSchema>;
