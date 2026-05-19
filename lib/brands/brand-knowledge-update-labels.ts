import type {
  BrandKnowledgeUpdateImportanceLevel,
  BrandKnowledgeUpdateStatus,
} from "@/lib/brands/brand-knowledge-update-types";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";

const KNOWLEDGE_SECTION_LABELS: Record<string, string> = {
  audience: "Audiencia",
  differentiators: "Diferenciadores",
  credibility: "Credibilidad",
  limbic: "Límbico",
  offer: "Oferta",
};

export function brandKnowledgeUpdateSectionLabelEs(sectionKey: string | null): string {
  const k = sectionKey?.trim() ?? "";
  if (!k) return "General";
  if (KNOWLEDGE_SECTION_LABELS[k]) return KNOWLEDGE_SECTION_LABELS[k]!;
  return brandQuestionnaireSectionLabelEs(k);
}

const IMPORTANCE_LABELS: Record<BrandKnowledgeUpdateImportanceLevel, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export function brandKnowledgeUpdateImportanceLabelEs(
  level: BrandKnowledgeUpdateImportanceLevel,
): string {
  return IMPORTANCE_LABELS[level];
}

const STATUS_LABELS: Record<BrandKnowledgeUpdateStatus, string> = {
  pending_review: "Pendiente de revisión",
  approved: "Aprobada (pendiente de consolidar)",
  discarded: "Descartada",
  incorporated: "Incorporada en la base",
};

export function brandKnowledgeUpdateStatusLabelEs(status: BrandKnowledgeUpdateStatus): string {
  return STATUS_LABELS[status];
}
