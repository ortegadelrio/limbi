import { z } from "zod";

export const brandKnowledgeUpdateSectionKeys = [
  "identity",
  "offer",
  "audience",
  "value_proposition",
  "differentiators",
  "credibility",
  "voice_tone",
  "restrictions",
  "limbic",
  "evidence",
  "other",
] as const;

export type BrandKnowledgeUpdateSectionKey =
  (typeof brandKnowledgeUpdateSectionKeys)[number];

export const brandKnowledgeUpdateSectionKeySchema = z.enum(
  brandKnowledgeUpdateSectionKeys,
);

export const brandKnowledgeUpdateImportanceLevels = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export type BrandKnowledgeUpdateImportanceLevel =
  (typeof brandKnowledgeUpdateImportanceLevels)[number];

export const brandKnowledgeUpdateImportanceLevelSchema = z.enum(
  brandKnowledgeUpdateImportanceLevels,
);

export const brandKnowledgeUpdateStatuses = [
  "pending_review",
  "approved",
  "discarded",
  "incorporated",
] as const;

export type BrandKnowledgeUpdateStatus =
  (typeof brandKnowledgeUpdateStatuses)[number];

export const brandKnowledgeUpdateStatusQuerySchema = z.enum([
  ...brandKnowledgeUpdateStatuses,
  "all",
]);

export type BrandKnowledgeUpdateClassification = {
  interpreted_summary: string;
  section_key: BrandKnowledgeUpdateSectionKey;
  importance_level: BrandKnowledgeUpdateImportanceLevel;
  must_include: boolean;
};
