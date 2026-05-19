import { z } from "zod";
import {
  brandKnowledgeUpdateImportanceLevelSchema,
  brandKnowledgeUpdateSectionKeySchema,
  brandKnowledgeUpdateStatusQuerySchema,
} from "@/lib/brands/brand-knowledge-update-types";

export const brandKnowledgeUpdatesGetQuerySchema = z.object({
  status: brandKnowledgeUpdateStatusQuerySchema.optional().default("pending_review"),
});

export const postBrandKnowledgeUpdateBodySchema = z.object({
  raw_text: z.string().trim().min(1).max(8000),
  /** Si viene del hub por sección, fija la clasificación en esa sección. */
  section_key: brandKnowledgeUpdateSectionKeySchema.optional(),
});

export const patchBrandKnowledgeUpdateBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    user_decision: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("discard"),
    reason_for_exclusion: z.string().max(2000).optional(),
    user_decision: z.string().max(2000).optional(),
  }),
]);

export type PostBrandKnowledgeUpdateBody = z.infer<typeof postBrandKnowledgeUpdateBodySchema>;
export type PatchBrandKnowledgeUpdateBody = z.infer<typeof patchBrandKnowledgeUpdateBodySchema>;

export {
  brandKnowledgeUpdateImportanceLevelSchema,
  brandKnowledgeUpdateSectionKeySchema,
};
