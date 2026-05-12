import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandEvaluationRow, BrandOfferNature } from "@/types/database";
import {
  buildBrandDiagnosisEvaluationContext,
  hasMinimumInputForDiagnosis,
  type BrandDiagnosisBrandSnapshot,
  type BrandDiagnosisEvaluationContext,
} from "@/lib/brands/build-brand-diagnosis-context";
import { BRAND_BASE_CONSOLIDATION_PROMPT_VERSION } from "@/lib/schemas/brand-base-consolidation";

export const BRAND_BASE_CONSOLIDATION_CONTEXT_VERSION = "brand-base-consolidation-context-v1.0";

export const BRAND_BASE_CONSOLIDATION_POLICY_V1 = {
  version: "brand-base-consolidation-policy-v1.0",
  notes: [
    "Lo crudo permanece en tablas; esta consolidación solo produce texto curado en `knowledge_base` y `limbic_base`.",
    "La evaluación activa orienta prioridades y tono estratégico; las mejoras aprobadas y activas tienen prioridad sobre respuestas previas en la misma pregunta.",
    "Solo entran facts con status approved; tensiones y riesgos van a restricciones/alertas, no a claims positivos.",
    "La Base Límbica es lectura simbólica (atmósfera, ritmo, sensibilidad): no copy literal ni datos demográficos inventados.",
  ],
} as const;

export type BrandBaseConsolidationActiveEvaluationSummary = {
  evaluation_id: string;
  created_at: string;
  prompt_version: string;
  overall_score: number | null;
  quality_level: string | null;
  strategic_reading: string | null;
  next_recommended_action: string | null;
  section_scores: unknown[];
};

export type BrandBaseConsolidationContext = Omit<
  BrandDiagnosisEvaluationContext,
  "context_version" | "scoring_policy"
> & {
  context_version: string;
  consolidation_policy: typeof BRAND_BASE_CONSOLIDATION_POLICY_V1;
  active_brand_evaluation: BrandBaseConsolidationActiveEvaluationSummary;
};

export type BuildBrandBaseConsolidationContextResult =
  | {
      ok: true;
      offerNature: BrandOfferNature;
      strategicSectionKeys: string[];
      consolidationContext: BrandBaseConsolidationContext;
      sourceSnapshot: Record<string, unknown>;
      activeEvaluation: BrandEvaluationRow;
    }
  | { ok: false; code: string; message: string };

export function buildBrandBaseConsolidationSourceSnapshot(args: {
  diagnosisSourceSnapshot: Record<string, unknown>;
  activeEvaluationId: string;
  consolidationRunId: string;
}): Record<string, unknown> {
  return {
    ...args.diagnosisSourceSnapshot,
    consolidation_context_version: BRAND_BASE_CONSOLIDATION_CONTEXT_VERSION,
    active_evaluation_id: args.activeEvaluationId,
    consolidation_run_id: args.consolidationRunId,
    consolidation_prompt_version: BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
  };
}

export async function buildBrandBaseConsolidationContext(
  supabase: SupabaseClient,
  brandId: string,
  brand: BrandDiagnosisBrandSnapshot,
): Promise<BuildBrandBaseConsolidationContextResult> {
  const { data: activeEvaluation, error: evErr } = await supabase
    .from("brand_evaluations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  if (evErr) {
    return { ok: false, code: "evaluation_fetch_error", message: evErr.message };
  }
  if (!activeEvaluation) {
    return {
      ok: false,
      code: "active_diagnosis_required",
      message:
        "Necesitás un diagnóstico de marca activo y exitoso antes de consolidar las bases.",
    };
  }

  const evaluation = activeEvaluation as BrandEvaluationRow;

  const built = await buildBrandDiagnosisEvaluationContext(
    supabase,
    brandId,
    brand,
    BRAND_BASE_CONSOLIDATION_PROMPT_VERSION,
  );
  if (!built.ok) {
    return built;
  }

  const approvedFactsCount = built.approvedFacts.length;
  const approvedImprovementsCount = built.context.approved_section_improvements.length;
  if (
    !hasMinimumInputForDiagnosis(built.responses, approvedFactsCount, approvedImprovementsCount, {
      structuredOfferItemCount: built.context.structured_offer_items.filter((i) =>
        i.title.trim(),
      ).length,
      structuredTerritoryCount: built.context.structured_audience_territories.filter((t) =>
        t.name.trim(),
      ).length,
    })
  ) {
    return {
      ok: false,
      code: "insufficient_input",
      message:
        "No hay información suficiente para consolidar. Completá el cuestionario o aprobá hallazgos de documentos.",
    };
  }

  const { scoring_policy, context_version, ...restDiagnosis } = built.context;
  void scoring_policy;
  void context_version;

  const active_brand_evaluation: BrandBaseConsolidationActiveEvaluationSummary = {
    evaluation_id: evaluation.id,
    created_at: evaluation.created_at,
    prompt_version: evaluation.prompt_version,
    overall_score: evaluation.overall_score,
    quality_level: evaluation.quality_level,
    strategic_reading: evaluation.strategic_reading,
    next_recommended_action: evaluation.next_recommended_action,
    section_scores: Array.isArray(evaluation.section_scores) ? evaluation.section_scores : [],
  };

  const consolidationContext: BrandBaseConsolidationContext = {
    ...restDiagnosis,
    context_version: BRAND_BASE_CONSOLIDATION_CONTEXT_VERSION,
    consolidation_policy: BRAND_BASE_CONSOLIDATION_POLICY_V1,
    active_brand_evaluation,
  };

  return {
    ok: true,
    offerNature: built.offerNature,
    strategicSectionKeys: built.strategicSectionKeys,
    consolidationContext,
    sourceSnapshot: built.sourceSnapshot,
    activeEvaluation: evaluation,
  };
}
