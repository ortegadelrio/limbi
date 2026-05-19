import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BRAND_DIAGNOSIS_SCORING_POLICY_V2,
  filterBrandResponsesForActiveDefinitions,
  type BrandDiagnosisStructuredAudienceTerritoryEntry,
  type BrandDiagnosisStructuredOfferItemEntry,
} from "@/lib/brands/build-brand-diagnosis-context";
import {
  normalizeDiagnosisSectionForImprovement,
  structuredSourcesGuidanceForImproveSection,
  type BrandSectionImprovementContextBrand,
} from "@/lib/brands/build-brand-section-improvement-context";
import { loadActiveBrandContextForProject } from "@/lib/brands/load-active-brand-context-for-project";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import type {
  BrandAudienceTerritoryRow,
  BrandEvaluationRow,
  BrandOfferItemRow,
  BrandOfferNature,
  BrandResponseRow,
  QuestionDefinitionRow,
} from "@/types/database";

export const BRAND_FIELD_IMPROVE_CONTEXT_VERSION = "brand-field-improve-context-v1.0";

const EXCLUDED_SECTIONS = new Set(["material_context"]);

/** Cuestionario → posibles claves en `section_scores` del diagnóstico. */
const DIAGNOSIS_SECTION_ALIASES: Record<string, string[]> = {
  differentiation: ["differentiators", "differentiation", "positioning"],
  voice_tone_messages: ["voice_tone", "voice_tone_messages"],
  audiences: ["audiences", "audience"],
  evidence: ["evidence", "proof", "credibility"],
};

const RESPONSE_EXCERPT_MAX = 500;
const INTERPRETATION_EXCERPT_MAX = 1200;

function truncateText(value: string, maxLen: number): string {
  const t = value.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function responseExcerpt(r: BrandResponseRow, maxLen: number): string {
  const t = (r.answer_text ?? "").trim();
  if (t.length > 0) {
    return truncateText(t, maxLen);
  }
  try {
    const j = JSON.stringify(r.answer_value ?? {});
    return truncateText(j, maxLen);
  } catch {
    return "";
  }
}

export function resolveDiagnosisSectionForQuestionnaireSection(
  sectionScores: BrandDiagnosisSectionScoreParsed[],
  questionnaireSectionKey: string,
): BrandDiagnosisSectionScoreParsed | null {
  const candidates = [
    questionnaireSectionKey,
    ...(DIAGNOSIS_SECTION_ALIASES[questionnaireSectionKey] ?? []),
  ];
  for (const key of candidates) {
    const row = sectionScores.find((s) => s.section_key === key) ?? null;
    if (row) return normalizeDiagnosisSectionForImprovement(row);
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function sectionInterpretationExcerpt(
  knowledgePayload: Record<string, unknown> | null,
  sectionKeys: string[],
): string | null {
  if (!knowledgePayload) return null;
  const sections = knowledgePayload.section_interpretations;
  if (!Array.isArray(sections)) return null;
  const wanted = new Set(sectionKeys);
  const parts: string[] = [];
  for (const row of sections) {
    const r = asRecord(row);
    const sk = typeof r?.section_key === "string" ? r.section_key : "";
    if (!sk || !wanted.has(sk)) continue;
    const summary =
      typeof r?.summary === "string"
        ? r.summary
        : typeof r?.interpretation === "string"
          ? r.interpretation
          : "";
    if (summary.trim()) parts.push(`[${sk}] ${summary.trim()}`);
  }
  if (parts.length === 0) return null;
  return truncateText(parts.join("\n"), INTERPRETATION_EXCERPT_MAX);
}

function limbicSymbolicExcerpt(limbicPayload: Record<string, unknown> | null): string | null {
  if (!limbicPayload) return null;
  const keys = [
    "symbolic_reading",
    "atmosphere_and_metaphor",
    "rhythm_and_energy",
    "expressive_codes",
    "non_literal_guidance",
    "symbolic_restrictions",
  ];
  const parts: string[] = [];
  for (const k of keys) {
    const v = limbicPayload[k];
    if (typeof v === "string" && v.trim()) parts.push(`${k}: ${v.trim()}`);
  }
  if (parts.length === 0) return null;
  return truncateText(parts.join("\n"), INTERPRETATION_EXCERPT_MAX);
}

export type BrandFieldImprovementContextTarget = {
  question_key: string;
  section_key: string;
  module_key: string;
  question_text: string;
  help_text: string | null;
  answer_type: string;
  is_required: boolean;
  is_sensitive: boolean;
  current_answer_text: string | null;
  current_answer_value: unknown;
};

export type BrandFieldImprovementContextResponse = {
  section_key: string;
  question_key: string;
  question_text: string;
  answer_excerpt: string;
  is_sensitive: boolean;
};

export type BrandFieldImprovementActiveBaseSummary = {
  has_active_knowledge_base: boolean;
  has_active_limbic_base: boolean;
  knowledge_base_is_stale: boolean;
  limbic_base_is_stale: boolean;
  restrictions_and_alerts_excerpt: string | null;
  section_interpretation_excerpt: string | null;
  limbic_symbolic_excerpt: string | null;
  interpretive_rules: string[];
};

export type BrandFieldImprovementContextPayload = {
  context_version: string;
  section_key: string;
  section_label: string;
  target_question: BrandFieldImprovementContextTarget;
  diagnosis_section: BrandDiagnosisSectionScoreParsed | null;
  brand_responses: BrandFieldImprovementContextResponse[];
  structured_context_note: string;
  structured_offer_items: BrandDiagnosisStructuredOfferItemEntry[];
  structured_audience_territories: BrandDiagnosisStructuredAudienceTerritoryEntry[];
  active_brand_context: BrandFieldImprovementActiveBaseSummary;
  scoring_policy: typeof BRAND_DIAGNOSIS_SCORING_POLICY_V2;
  brand: BrandSectionImprovementContextBrand;
};

export type BuildBrandFieldImprovementContextResult =
  | { ok: true; context: BrandFieldImprovementContextPayload; definition: QuestionDefinitionRow }
  | { ok: false; code: string; message: string };

export async function buildBrandFieldImprovementContext(
  supabase: SupabaseClient,
  brandId: string,
  questionKey: string,
  brand: BrandSectionImprovementContextBrand,
): Promise<BuildBrandFieldImprovementContextResult> {
  const { data: profile, error: pErr } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (pErr) {
    return { ok: false, code: "profile_error", message: pErr.message };
  }
  const offerNature = profile?.offer_nature as BrandOfferNature | undefined;
  if (!offerNature) {
    return {
      ok: false,
      code: "offer_profile_required",
      message: "La marca necesita naturaleza de oferta.",
    };
  }

  const { rows: definitions, error: dErr } =
    await fetchAllowedBrandQuestionDefinitions(supabase, offerNature);
  if (dErr) {
    return { ok: false, code: "definitions_error", message: dErr.message };
  }

  const def = definitions.find((d) => d.question_key === questionKey) ?? null;
  if (!def) {
    return {
      ok: false,
      code: "invalid_question",
      message: "La pregunta no existe en el catálogo para esta marca.",
    };
  }
  if (EXCLUDED_SECTIONS.has(def.section_key)) {
    return {
      ok: false,
      code: "invalid_section",
      message: "Esta sección no admite mejora asistida por campo.",
    };
  }

  const { data: evaluation, error: evErr } = await supabase
    .from("brand_evaluations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  if (evErr) {
    return { ok: false, code: "evaluation_error", message: evErr.message };
  }
  if (!evaluation) {
    return {
      ok: false,
      code: "diagnosis_required",
      message: "Necesitas un diagnóstico de marca activo antes de usar «Mejorar con Limbi».",
    };
  }

  const ev = evaluation as BrandEvaluationRow;
  const sectionScores = (ev.section_scores ?? []) as BrandDiagnosisSectionScoreParsed[];
  const diagnosisSection = resolveDiagnosisSectionForQuestionnaireSection(
    sectionScores,
    def.section_key,
  );

  const [
    { data: allResponses, error: rErr },
    { data: offerItemRows, error: offerErr },
    { data: territoryRows, error: terrErr },
    activeCtx,
  ] = await Promise.all([
    supabase
      .from("brand_responses")
      .select(
        "id, brand_id, question_definition_id, section_key, module_key, question_key, answer_value, answer_text, answer_type, is_required, is_sensitive, source_type, created_at, updated_at",
      )
      .eq("brand_id", brandId),
    supabase
      .from("brand_offer_items")
      .select("item_type, title, description, display_order")
      .eq("brand_id", brandId)
      .order("display_order", { ascending: true }),
    supabase
      .from("brand_audience_territories")
      .select("territory_type, name, display_order")
      .eq("brand_id", brandId)
      .order("display_order", { ascending: true }),
    loadActiveBrandContextForProject(supabase, brandId),
  ]);

  if (rErr) {
    return { ok: false, code: "responses_error", message: rErr.message };
  }
  if (offerErr) {
    return { ok: false, code: "offer_items_error", message: offerErr.message };
  }
  if (terrErr) {
    return { ok: false, code: "territories_error", message: terrErr.message };
  }

  const structuredOfferItems: BrandDiagnosisStructuredOfferItemEntry[] = (offerItemRows ?? []).map(
    (row) => ({
      item_type: (row as BrandOfferItemRow).item_type,
      title: String((row as BrandOfferItemRow).title ?? "").trim(),
      description: (row as BrandOfferItemRow).description,
    }),
  );
  const structuredTerritories: BrandDiagnosisStructuredAudienceTerritoryEntry[] = (
    territoryRows ?? []
  ).map((row) => ({
    territory_type: (row as BrandAudienceTerritoryRow).territory_type,
    name: String((row as BrandAudienceTerritoryRow).name ?? "").trim(),
  }));

  const responseRows = filterBrandResponsesForActiveDefinitions(
    (allResponses ?? []) as BrandResponseRow[],
    definitions,
  );
  const defByKey = new Map(definitions.map((d) => [d.question_key, d]));
  const targetResponse =
    responseRows.find((r) => r.question_key === questionKey) ?? null;

  const baseSectionKeys = [
    def.section_key,
    ...(DIAGNOSIS_SECTION_ALIASES[def.section_key] ?? []),
  ];

  let activeBaseSummary: BrandFieldImprovementActiveBaseSummary = {
    has_active_knowledge_base: false,
    has_active_limbic_base: false,
    knowledge_base_is_stale: false,
    limbic_base_is_stale: false,
    restrictions_and_alerts_excerpt: null,
    section_interpretation_excerpt: null,
    limbic_symbolic_excerpt: null,
    interpretive_rules: [],
  };

  if (activeCtx.ok) {
    const restrictions =
      typeof activeCtx.knowledge_payload?.restrictions_and_alerts === "string"
        ? activeCtx.knowledge_payload.restrictions_and_alerts
        : null;
    activeBaseSummary = {
      has_active_knowledge_base: Boolean(activeCtx.active_knowledge_base),
      has_active_limbic_base: Boolean(activeCtx.active_limbic_base),
      knowledge_base_is_stale: activeCtx.knowledge_base_is_stale,
      limbic_base_is_stale: activeCtx.limbic_base_is_stale,
      restrictions_and_alerts_excerpt: restrictions
        ? truncateText(restrictions, INTERPRETATION_EXCERPT_MAX)
        : null,
      section_interpretation_excerpt: sectionInterpretationExcerpt(
        activeCtx.knowledge_payload,
        baseSectionKeys,
      ),
      limbic_symbolic_excerpt:
        def.section_key === "brand_limbic_base"
          ? limbicSymbolicExcerpt(activeCtx.limbic_payload)
          : limbicSymbolicExcerpt(activeCtx.limbic_payload),
      interpretive_rules: [...activeCtx.interpretive_rules],
    };
  }

  const brandResponsesForContext: BrandFieldImprovementContextResponse[] = [];
  for (const row of responseRows) {
    const qDef = defByKey.get(row.question_key);
    if (!qDef) continue;
    const excerpt = responseExcerpt(row, RESPONSE_EXCERPT_MAX);
    if (!excerpt && !row.is_required) continue;
    brandResponsesForContext.push({
      section_key: row.section_key,
      question_key: row.question_key,
      question_text: qDef.question_text,
      answer_excerpt: row.is_sensitive
        ? "[contenido sensible — presente en cuestionario]"
        : excerpt || "[sin respuesta]",
      is_sensitive: row.is_sensitive,
    });
  }

  const context: BrandFieldImprovementContextPayload = {
    context_version: BRAND_FIELD_IMPROVE_CONTEXT_VERSION,
    section_key: def.section_key,
    section_label: brandQuestionnaireSectionLabelEs(def.section_key),
    target_question: {
      question_key: def.question_key,
      section_key: def.section_key,
      module_key: def.module_key,
      question_text: def.question_text,
      help_text: def.help_text,
      answer_type: def.answer_type,
      is_required: def.is_required,
      is_sensitive: def.is_sensitive,
      current_answer_text: targetResponse?.answer_text ?? null,
      current_answer_value: targetResponse?.answer_value ?? null,
    },
    diagnosis_section: diagnosisSection,
    brand_responses: brandResponsesForContext,
    structured_context_note: structuredSourcesGuidanceForImproveSection(def.section_key),
    structured_offer_items: structuredOfferItems,
    structured_audience_territories: structuredTerritories,
    active_brand_context: activeBaseSummary,
    scoring_policy: BRAND_DIAGNOSIS_SCORING_POLICY_V2,
    brand,
  };

  return { ok: true, context, definition: def };
}
