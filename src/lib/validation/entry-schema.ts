import { z } from "zod";

/**
 * Canonical server-side entry validation schema.
 * business_id is validated for shape but request handlers should still derive
 * authorization from authenticated user context.
 */
export const EntrySchema = z.object({
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  type: z.enum(["income", "expense", "asset", "liability"]),
  amount: z.number().positive(),
  vat_amount: z.number().nonnegative().optional(),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
  receipt_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  source: z.enum(["bumpa", "manual", "pos", "transfer"]).optional(),
  tax_code: z.string().max(64).optional(),
  vat_applicable: z.boolean().optional(),
  payment_method: z.string().max(64).optional(),
  linked_invoice_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/,
      "created_at must be ISO date or YYYY-MM-DD",
    )
    .optional(),
});

export type EntryPayload = z.infer<typeof EntrySchema>;

