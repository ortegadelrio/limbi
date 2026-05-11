import { z } from "zod";

export const brandSourceFactStatusQuerySchema = z.enum([
  "pending_review",
  "approved",
  "rejected",
  "superseded",
  "all",
]);

export const brandSourceFactsGetQuerySchema = z.object({
  status: brandSourceFactStatusQuerySchema.optional().default("pending_review"),
  brand_document_id: z.string().uuid().optional(),
  analysis_batch_id: z.string().uuid().optional(),
  section_key: z.string().min(1).max(120).optional(),
});

export const patchBrandSourceFactBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("approve_with_edit"),
    user_edited_text: z.string().min(1).max(8000),
  }),
  z.object({
    action: z.literal("reject"),
    rejection_reason: z.string().max(2000).optional(),
  }),
]);

export type PatchBrandSourceFactBody = z.infer<typeof patchBrandSourceFactBodySchema>;
