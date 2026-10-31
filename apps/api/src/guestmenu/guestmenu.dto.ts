import { z } from 'zod';
import { caps } from './guestmenu.config';

const uuid = z.string().uuid();

/** Free text typed by a guest: control characters become spaces, then trimmed. */
const text = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((v) => v.replace(/[\p{C}]/gu, ' ').replace(/\s+/g, ' ').trim())
    .pipe(z.string().max(max));

export const createGuestSchema = z.object({ displayName: text(40).optional() }).strict();
export type CreateGuestDto = z.infer<typeof createGuestSchema>;

const lineSchema = z
  .object({
    itemId: uuid,
    variantId: uuid.optional(),
    addOnOptionIds: z.array(uuid).max(30).optional(),
    qty: z.number().int().min(1),
    note: text(140).optional(),
  })
  .strict();

/** Built per request so the (env-tunable) caps are honoured. */
export function placeOrderSchema() {
  return z
    .object({
      lines: z.array(lineSchema).min(1).max(caps.maxLines()),
      note: text(200).optional(),
    })
    .strict()
    .superRefine((dto, ctx) => {
      let total = 0;
      dto.lines.forEach((l, i) => {
        total += l.qty;
        if (l.qty > caps.maxQty()) ctx.addIssue({ code: 'custom', path: ['lines', i, 'qty'], message: `At most ${caps.maxQty()} of one item per order` });
      });
      if (total > caps.maxTotalQty()) ctx.addIssue({ code: 'custom', path: ['lines'], message: `At most ${caps.maxTotalQty()} items per order` });
    });
}
export type PlaceOrderDto = z.infer<ReturnType<typeof placeOrderSchema>>;

export const waiterSchema = z.object({ reason: z.enum(['call', 'bill', 'water', 'other']) }).strict();
export type WaiterDto = z.infer<typeof waiterSchema>;

export const payIntentSchema = z.object({ method: z.literal('upi') }).strict();

// ── Staff side ─────────────────────────────────────────────────────────────────

export const patchQrTableSchema = z
  .object({
    enabled: z.boolean().optional(),
    orderingEnabled: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine((v) => v.enabled !== undefined || v.orderingEnabled !== undefined, 'Nothing to change');
export type PatchQrTableDto = z.infer<typeof patchQrTableSchema>;

export const rotateQrSchema = z.object({ expectedVersion: z.number().int().positive().optional() }).strict();
export type RotateQrDto = z.infer<typeof rotateQrSchema>;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #1dba3c');

export const patchQrSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    ordering: z.enum(['off', 'confirm', 'auto']).optional(),
    callWaiter: z.boolean().optional(),
    upi: z.boolean().optional(),
    tagline: z.union([text(120), z.null()]).optional(),
    accentColor: z.union([color, z.null()]).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).some((k) => k !== 'expectedVersion'), 'Nothing to change');
export type PatchQrSettingsDto = z.infer<typeof patchQrSettingsSchema>;

export const guestOrderListQuery = z
  .object({
    status: z.enum(['AWAITING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED']).optional(),
    locationId: uuid.optional(),
    take: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();
export type GuestOrderListQuery = z.infer<typeof guestOrderListQuery>;

export const rejectGuestOrderSchema = z.object({ reason: z.string().trim().min(1).max(300) }).strict();
export type RejectGuestOrderDto = z.infer<typeof rejectGuestOrderSchema>;

export const editGuestOrderSchema = z
  .object({
    lines: z.array(z.object({ id: uuid, qty: z.number().int().min(0).max(99) }).strict()).max(100).default([]),
    note: z.union([z.string().trim().max(500), z.null()]).optional(),
  })
  .strict()
  .refine((v) => v.lines.length > 0 || v.note !== undefined, 'Nothing to change');
export type EditGuestOrderDto = z.infer<typeof editGuestOrderSchema>;

export const presentationSchema = z
  .object({
    dietType: z.union([z.enum(['VEG', 'NONVEG', 'EGG']), z.null()]).optional(),
    menuTags: z.array(z.string().trim().min(1).max(24)).max(6).optional(),
    spiceLevel: z.union([z.number().int().min(0).max(3), z.null()]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change');
export type PresentationDto = z.infer<typeof presentationSchema>;
