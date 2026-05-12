import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandOfferNature,
  BrandResponseRow,
  BrandSourceFactRow,
  BrandSectionImprovementRow,
  QuestionDefinitionRow,
  BrandEvaluationRow,
} from "@/types/database";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";

export const BRAND_SECTION_IMPROVE_CONTEXT_VERSION = "brand-section-improve-context-v1";

const EXCLUDED_SECTIONS = new Set(["material_context"]);

const COHERENCE_SECTION_KEYS = [
  "identity",
  "description",
  "value_proposition",
  "positioning",
] as const;

export type BrandSectionImprovementContextBrand = {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  country_or_market: string | null;
  brand_status: string;
};

export type ImprovementContextQuestionDef = {
  section_key: string;
  module_key: string;
  question_key: string;
  question_text: string;
  is_required: boolean;
  answer_type: string;
  is_sensitive: boolean;
  evaluation_weight: number;
};

export type ImprovementContextResponse = {
  question_key: string;
  module_key: string;
  answer_text: string | null;
  answer_value: unknown;
  is_required: boolean;
  is_sensitive: boolean;
};

export type ImprovementContextApprovedFact = {
  question_key: string | null;
  usable_text: string;
  extracted_fact: string;
  fact_type: string;
  relationship_type: string;
  source_document_name: string | null;
};

export type ImprovementContextPreviousImprovement = {
  approved_at: string | null;
  payload_summary: string;
};

export type ImprovementContextCoherenceSnippet = {
  section_key: string;
  question_key: string;
  question_text: string;
  answer_excerpt: string;
};

export type BrandSectionImprovementContextPayload = {
  context_version: string;
  section_key: string;
  brand: BrandSectionImprovementContextBrand;
  offer_nature: BrandOfferNature;
  diagnosis_section: BrandDiagnosisSectionScoreParsed | null;
  question_definitions: ImprovementContextQuestionDef[];
  brand_responses: ImprovementContextResponse[];
  approved_source_facts: ImprovementContextApprovedFact[];
  previous_approved_improvement: ImprovementContextPreviousImprovement | null;
  coherence_snippets: ImprovementContextCoherenceSnippet[];
};

function usableFactText(f: BrandSourceFactRow): string {
  const edited = (f.user_edited_text ?? "").trim();
  if (edited.length > 0) return edited;
  return f.proposed_inclusion.trim();
}

function responseExcerpt(r: BrandResponseRow, maxLen: number): string {
  const t = (r.answer_text ?? "").trim();
  if (t.length > 0) {
    return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
  }
  try {
    const j = JSON.stringify(r.answer_value ?? {});
    return j.length <= maxLen ? j : `${j.slice(0, maxLen)}…`;
  } catch {
    return "";
  }
}

export type BuildBrandSectionImprovementContextResult =
  | { ok: true; context: BrandSectionImprovementContextPayload; questionKeys: Set<string> }
  | { ok: false; code: string; message: string };

export async function buildBrandSectionImprovementContext(
  supabase: SupabaseClient,
  brandId: string,
  sectionKey: string,
  brand: BrandSectionImprovementContextBrand,
): Promise<BuildBrandSectionImprovementContextResult> {
  if (EXCLUDED_SECTIONS.has(sectionKey)) {
    return {
      ok: false,
      code: "invalid_section",
      message: "Esta sección no admite mejora asistida.",
    };
  }

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

  const sectionDefs = definitions.filter(
    (d) => d.section_key === sectionKey && !EXCLUDED_SECTIONS.has(d.section_key),
  );
  if (sectionDefs.length === 0) {
    return {
      ok: false,
      code: "invalid_section",
      message: "La sección no existe en el catálogo para esta naturaleza de oferta.",
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
      message: "Necesitas un diagnóstico de marca activo antes de mejorar por sección.",
    };
  }

  const ev = evaluation as BrandEvaluationRow;
  const sectionScores = (ev.section_scores ?? []) as BrandDiagnosisSectionScoreParsed[];
  const diagnosisSection =
    sectionScores.find((s) => s.section_key === sectionKey) ?? null;

  const { data: responses, error: rErr } = await supabase
    .from("brand_responses")
    .select(
      "id, brand_id, question_definition_id, section_key, module_key, question_key, answer_value, answer_text, answer_type, is_required, is_sensitive, source_type, created_at, updated_at",
    )
    .eq("brand_id", brandId)
    .eq("section_key", sectionKey);

  if (rErr) {
    return { ok: false, code: "responses_error", message: rErr.message };
  }
  const responseRows = (responses ?? []) as BrandResponseRow[];

  const { data: facts, error: fErr } = await supabase
    .from("brand_source_facts")
    .select(
      "id, brand_id, section_key, module_key, question_key, relationship_type, fact_type, source_document_name, extracted_fact, proposed_inclusion, user_edited_text, status",
    )
    .eq("brand_id", brandId)
    .eq("section_key", sectionKey)
    .eq("status", "approved");

  if (fErr) {
    return { ok: false, code: "facts_error", message: fErr.message };
  }
  const factRows = (facts ?? []) as BrandSourceFactRow[];

  const { data: prevImp, error: piErr } = await supabase
    .from("brand_section_improvements")
    .select("id, approved_at, payload, status, is_active")
    .eq("brand_id", brandId)
    .eq("section_key", sectionKey)
    .eq("status", "approved")
    .eq("is_active", true)
    .maybeSingle();

  if (piErr) {
    return { ok: false, code: "improvement_error", message: piErr.message };
  }

  const prevRow = prevImp as BrandSectionImprovementRow | null;
  let previousApproved: ImprovementContextPreviousImprovement | null = null;
  if (prevRow?.payload) {
    const summary = JSON.stringify(prevRow.payload).slice(0, 2000);
    previousApproved = {
      approved_at: prevRow.approved_at,
      payload_summary: summary.length < 4000 ? summary : `${summary.slice(0, 2000)}…`,
    };
  }

  const coherence_snippets: ImprovementContextCoherenceSnippet[] = [];
  const coherenceKeys = COHERENCE_SECTION_KEYS.filter((sk) => sk !== sectionKey);

  if (coherenceKeys.length > 0) {
    const { data: cohResp, error: cErr } = await supabase
      .from("brand_responses")
      .select("section_key, module_key, question_key, answer_text, answer_value, is_sensitive")
      .eq("brand_id", brandId)
      .in("section_key", [...coherenceKeys]);

    if (!cErr && cohResp) {
      const defByKey = new Map(
        (definitions as QuestionDefinitionRow[]).map((d) => [d.question_key, d]),
      );
      for (const row of cohResp as BrandResponseRow[]) {
        const def = defByKey.get(row.question_key);
        if (!def) continue;
        const excerpt = responseExcerpt(row, 400);
        if (!excerpt) continue;
        coherence_snippets.push({
          section_key: row.section_key,
          question_key: row.question_key,
          question_text: def.question_text,
          answer_excerpt: row.is_sensitive
            ? "[contenido sensible — presente en cuestionario]"
            : excerpt,
        });
      }
    }
  }

  const questionKeys = new Set(sectionDefs.map((d) => d.question_key));

  const context: BrandSectionImprovementContextPayload = {
    context_version: BRAND_SECTION_IMPROVE_CONTEXT_VERSION,
    section_key: sectionKey,
    brand,
    offer_nature: offerNature,
    diagnosis_section: diagnosisSection,
    question_definitions: sectionDefs.map((d) => ({
      section_key: d.section_key,
      module_key: d.module_key,
      question_key: d.question_key,
      question_text: d.question_text,
      is_required: d.is_required,
      answer_type: d.answer_type,
      is_sensitive: d.is_sensitive,
      evaluation_weight: d.evaluation_weight,
    })),
    brand_responses: responseRows.map((r) => ({
      question_key: r.question_key,
      module_key: r.module_key,
      answer_text: r.answer_text,
      answer_value: r.answer_value,
      is_required: r.is_required,
      is_sensitive: r.is_sensitive,
    })),
    approved_source_facts: factRows.map((f) => ({
      question_key: f.question_key,
      usable_text: usableFactText(f),
      extracted_fact: f.extracted_fact,
      fact_type: f.fact_type,
      relationship_type: f.relationship_type,
      source_document_name: f.source_document_name,
    })),
    previous_approved_improvement: previousApproved,
    coherence_snippets,
  };

  return { ok: true, context, questionKeys };
}
