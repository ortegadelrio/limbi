import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandOfferNature,
  BrandRow,
  BrandSourceFactRow,
  BrandResponseRow,
  QuestionDefinitionRow,
} from "@/types/database";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import { groupBrandQuestionDefinitionsBySection } from "@/lib/questions/get-brand-question-definitions";

export const BRAND_DIAGNOSIS_CONTEXT_VERSION = "brand-diagnosis-context-v1";

/** Secciones operativas que no entran al diagnóstico estratégico. */
const EXCLUDED_DIAGNOSIS_SECTIONS = new Set(["material_context"]);

export type BrandDiagnosisBrandSnapshot = Pick<
  BrandRow,
  "id" | "name" | "description" | "website_url" | "country_or_market" | "brand_status"
>;

export type BrandDiagnosisDefinitionEntry = {
  section_key: string;
  module_key: string;
  question_key: string;
  question_text: string;
  evaluation_weight: number;
  is_required: boolean;
  answer_type: string;
  is_sensitive: boolean;
};

export type BrandDiagnosisResponseEntry = {
  section_key: string;
  module_key: string;
  question_key: string;
  answer_text: string | null;
  answer_value: unknown;
  is_required: boolean;
  is_sensitive: boolean;
};

export type BrandDiagnosisApprovedFactEntry = {
  section_key: string;
  module_key: string | null;
  question_key: string | null;
  relationship_type: string;
  fact_type: string;
  usable_text: string;
  source_document_name: string | null;
  extracted_fact: string;
  ai_interpretation: string | null;
};

export type BrandDiagnosisSectionCoverageEntry = {
  section_key: string;
  required_questions: number;
  required_answered: number;
  optional_questions: number;
  optional_answered: number;
  approved_facts_count: number;
  /** Heurística: sin respuestas con contenido ni facts aprobados en la sección. */
  appears_empty: boolean;
};

export type BrandDiagnosisEvaluationContext = {
  context_version: string;
  brand: BrandDiagnosisBrandSnapshot;
  brand_offer_profile: { offer_nature: BrandOfferNature };
  question_definitions: BrandDiagnosisDefinitionEntry[];
  brand_responses: BrandDiagnosisResponseEntry[];
  approved_source_facts: BrandDiagnosisApprovedFactEntry[];
  section_coverage_summary: BrandDiagnosisSectionCoverageEntry[];
};

function responseHasContent(r: BrandResponseRow): boolean {
  const t = (r.answer_text ?? "").trim();
  if (t.length > 0) return true;
  try {
    const v = JSON.stringify(r.answer_value ?? {});
    return v.length > 2 && v !== "{}";
  } catch {
    return false;
  }
}

function usableFactText(f: BrandSourceFactRow): string {
  const edited = (f.user_edited_text ?? "").trim();
  if (edited.length > 0) return edited;
  return f.proposed_inclusion.trim();
}

/** Orden estable de section_key estratégicos (excluye material_context). */
export function strategicSectionKeysFromDefinitions(
  definitions: QuestionDefinitionRow[],
): string[] {
  const groups = groupBrandQuestionDefinitionsBySection(definitions);
  return groups
    .map((g) => g.section_key)
    .filter((sk) => !EXCLUDED_DIAGNOSIS_SECTIONS.has(sk));
}

function buildCoverage(
  definitions: QuestionDefinitionRow[],
  responses: BrandResponseRow[],
  facts: BrandSourceFactRow[],
  strategicSectionKeys: string[],
): BrandDiagnosisSectionCoverageEntry[] {
  const bySection = new Map<string, QuestionDefinitionRow[]>();
  for (const d of definitions) {
    if (EXCLUDED_DIAGNOSIS_SECTIONS.has(d.section_key)) continue;
    const list = bySection.get(d.section_key) ?? [];
    list.push(d);
    bySection.set(d.section_key, list);
  }

  const respBySection = new Map<string, BrandResponseRow[]>();
  for (const r of responses) {
    if (EXCLUDED_DIAGNOSIS_SECTIONS.has(r.section_key)) continue;
    const list = respBySection.get(r.section_key) ?? [];
    list.push(r);
    respBySection.set(r.section_key, list);
  }

  const factsCountBySection = new Map<string, number>();
  for (const f of facts) {
    if (EXCLUDED_DIAGNOSIS_SECTIONS.has(f.section_key)) continue;
    factsCountBySection.set(f.section_key, (factsCountBySection.get(f.section_key) ?? 0) + 1);
  }

  return strategicSectionKeys.map((section_key) => {
    const defs = bySection.get(section_key) ?? [];
    const required = defs.filter((d) => d.is_required);
    const optional = defs.filter((d) => !d.is_required);
    const sectionResponses = respBySection.get(section_key) ?? [];

    const countAnswered = (list: QuestionDefinitionRow[]) =>
      list.filter((d) => {
        const r = sectionResponses.find((x) => x.question_key === d.question_key);
        return r ? responseHasContent(r) : false;
      }).length;

    const requiredAnswered = countAnswered(required);
    const optionalAnswered = countAnswered(optional);
    const approvedFactsCount = factsCountBySection.get(section_key) ?? 0;
    const hasResponseContent = sectionResponses.some((r) => responseHasContent(r));
    const appears_empty = !hasResponseContent && approvedFactsCount === 0;

    return {
      section_key,
      required_questions: required.length,
      required_answered: requiredAnswered,
      optional_questions: optional.length,
      optional_answered: optionalAnswered,
      approved_facts_count: approvedFactsCount,
      appears_empty,
    };
  });
}

/** Metadatos para `source_snapshot` (sin texto sensible ni duplicar cuestionario completo). */
export function buildBrandDiagnosisSourceSnapshot(args: {
  strategicSectionKeys: string[];
  offerNature: BrandOfferNature;
  promptVersion: string;
  definitionsCount: number;
  responses: BrandResponseRow[];
  approvedFactsCount: number;
}): Record<string, unknown> {
  const sanitizedResponses = args.responses.map((r) => ({
    section_key: r.section_key,
    question_key: r.question_key,
    is_required: r.is_required,
    is_sensitive: r.is_sensitive,
    has_text: (r.answer_text ?? "").trim().length > 0,
    answer_text_len: (r.answer_text ?? "").length,
  }));

  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        strategic_section_keys: args.strategicSectionKeys,
        offer_nature: args.offerNature,
        prompt_version: args.promptVersion,
        definitions_count: args.definitionsCount,
        responses_meta: sanitizedResponses,
        approved_facts_count: args.approvedFactsCount,
      }),
    )
    .digest("hex");

  return {
    context_version: BRAND_DIAGNOSIS_CONTEXT_VERSION,
    prompt_version: args.promptVersion,
    offer_nature: args.offerNature,
    strategic_section_keys: args.strategicSectionKeys,
    definitions_count: args.definitionsCount,
    response_count: args.responses.length,
    sensitive_response_count: args.responses.filter((r) => r.is_sensitive).length,
    approved_facts_count: args.approvedFactsCount,
    responses_meta_hash: inputHash,
  };
}

export type BuildBrandDiagnosisContextResult =
  | {
      ok: true;
      offerNature: BrandOfferNature;
      strategicSectionKeys: string[];
      context: BrandDiagnosisEvaluationContext;
      sourceSnapshot: Record<string, unknown>;
      responses: BrandResponseRow[];
      approvedFacts: BrandSourceFactRow[];
    }
  | { ok: false; code: string; message: string };

export async function buildBrandDiagnosisEvaluationContext(
  supabase: SupabaseClient,
  brandId: string,
  brand: BrandDiagnosisBrandSnapshot,
  promptVersion: string,
): Promise<BuildBrandDiagnosisContextResult> {
  const { data: profile, error: profileErr } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (profileErr) {
    return { ok: false, code: "profile_error", message: profileErr.message };
  }
  const offerNature = profile?.offer_nature as BrandOfferNature | undefined;
  if (!offerNature) {
    return {
      ok: false,
      code: "offer_profile_required",
      message:
        "La marca necesita una naturaleza de oferta antes de generar el diagnóstico.",
    };
  }

  const { rows: definitions, error: defErr } =
    await fetchAllowedBrandQuestionDefinitions(supabase, offerNature);
  if (defErr) {
    return { ok: false, code: "definitions_error", message: defErr.message };
  }
  if (definitions.length === 0) {
    return {
      ok: false,
      code: "insufficient_catalog",
      message: "No hay definiciones de cuestionario aplicables a esta marca.",
    };
  }

  const strategicSectionKeys = strategicSectionKeysFromDefinitions(definitions);
  if (strategicSectionKeys.length === 0) {
    return {
      ok: false,
      code: "insufficient_catalog",
      message: "No hay secciones estratégicas para diagnosticar.",
    };
  }

  const { data: responseRows, error: respErr } = await supabase
    .from("brand_responses")
    .select(
      "id, brand_id, question_definition_id, section_key, module_key, question_key, answer_value, answer_text, answer_type, is_required, is_sensitive, source_type, created_at, updated_at",
    )
    .eq("brand_id", brandId);

  if (respErr) {
    return { ok: false, code: "responses_error", message: respErr.message };
  }
  const responses = (responseRows ?? []) as BrandResponseRow[];

  const { data: factRows, error: factErr } = await supabase
    .from("brand_source_facts")
    .select(
      "id, brand_id, source_type, brand_document_id, brand_document_extraction_id, analysis_batch_id, analysis_run_id, section_key, module_key, question_key, relationship_type, fact_type, source_excerpt, source_reference, source_document_name, supporting_documents, extracted_fact, ai_interpretation, existing_response_summary, proposed_inclusion, user_edited_text, status, rejection_reason, confidence_score, dedupe_fingerprint, sort_order, created_at, updated_at, reviewed_at",
    )
    .eq("brand_id", brandId)
    .eq("status", "approved");

  if (factErr) {
    return { ok: false, code: "facts_error", message: factErr.message };
  }
  const approvedFacts = (factRows ?? []) as BrandSourceFactRow[];

  const defEntries: BrandDiagnosisDefinitionEntry[] = definitions
    .filter((d) => !EXCLUDED_DIAGNOSIS_SECTIONS.has(d.section_key))
    .map((d) => ({
      section_key: d.section_key,
      module_key: d.module_key,
      question_key: d.question_key,
      question_text: d.question_text,
      evaluation_weight: d.evaluation_weight,
      is_required: d.is_required,
      answer_type: d.answer_type,
      is_sensitive: d.is_sensitive,
    }));

  const respEntries: BrandDiagnosisResponseEntry[] = responses
    .filter((r) => !EXCLUDED_DIAGNOSIS_SECTIONS.has(r.section_key))
    .map((r) => ({
      section_key: r.section_key,
      module_key: r.module_key,
      question_key: r.question_key,
      answer_text: r.answer_text,
      answer_value: r.answer_value,
      is_required: r.is_required,
      is_sensitive: r.is_sensitive,
    }));

  const factEntries: BrandDiagnosisApprovedFactEntry[] = approvedFacts
    .filter((f) => !EXCLUDED_DIAGNOSIS_SECTIONS.has(f.section_key))
    .map((f) => ({
      section_key: f.section_key,
      module_key: f.module_key,
      question_key: f.question_key,
      relationship_type: f.relationship_type,
      fact_type: f.fact_type,
      usable_text: usableFactText(f),
      source_document_name: f.source_document_name,
      extracted_fact: f.extracted_fact,
      ai_interpretation: f.ai_interpretation,
    }));

  const coverage = buildCoverage(definitions, responses, approvedFacts, strategicSectionKeys);

  const context: BrandDiagnosisEvaluationContext = {
    context_version: BRAND_DIAGNOSIS_CONTEXT_VERSION,
    brand,
    brand_offer_profile: { offer_nature: offerNature },
    question_definitions: defEntries,
    brand_responses: respEntries,
    approved_source_facts: factEntries,
    section_coverage_summary: coverage,
  };

  const sourceSnapshot = buildBrandDiagnosisSourceSnapshot({
    strategicSectionKeys,
    offerNature,
    promptVersion,
    definitionsCount: defEntries.length,
    responses,
    approvedFactsCount: factEntries.length,
  });

  return {
    ok: true,
    offerNature,
    strategicSectionKeys,
    context,
    sourceSnapshot,
    responses,
    approvedFacts,
  };
}

/** Mínimo: al menos una respuesta con contenido en sección estratégica o un fact aprobado. */
export function hasMinimumInputForDiagnosis(
  responses: BrandResponseRow[],
  approvedFactsCount: number,
): boolean {
  if (approvedFactsCount > 0) return true;
  return responses.some(
    (r) => !EXCLUDED_DIAGNOSIS_SECTIONS.has(r.section_key) && responseHasContent(r),
  );
}
