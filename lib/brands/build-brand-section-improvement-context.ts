import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandOfferNature,
  BrandResponseRow,
  BrandSourceFactRow,
  BrandSectionImprovementRow,
  QuestionDefinitionRow,
  BrandEvaluationRow,
  BrandOfferItemRow,
  BrandAudienceTerritoryRow,
} from "@/types/database";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import type { BrandDiagnosisSectionScoreParsed } from "@/lib/schemas/brand-diagnosis";
import {
  BRAND_DIAGNOSIS_SCORING_POLICY_V2,
  filterBrandResponsesForActiveDefinitions,
  type BrandDiagnosisStructuredAudienceTerritoryEntry,
  type BrandDiagnosisStructuredOfferItemEntry,
} from "@/lib/brands/build-brand-diagnosis-context";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";

export const BRAND_SECTION_IMPROVE_CONTEXT_VERSION = "brand-section-improve-context-v2.0";

const EXCLUDED_SECTIONS = new Set(["material_context"]);

const COHERENCE_SECTION_KEYS = [
  "identity",
  "description",
  "value_proposition",
  "positioning",
] as const;

/** Alineado con diagnóstico: secciones donde el inventario estructurado es fuente canónica de oferta. */
const SECTION_KEYS_WITH_STRUCTURAL_OFFER_CONTEXT = new Set<string>([
  "offer",
  "product",
  "service",
  "product_service",
  "experience_event",
  "digital_platform",
  "organization",
  "personal_brand",
  "value_proposition",
]);

const SECTION_KEYS_WITH_STRUCTURAL_TERRITORY_CONTEXT = new Set<string>(["audiences"]);

export function structuredSourcesGuidanceForImproveSection(sectionKey: string): string {
  const parts: string[] = [
    "brand_responses son respuestas simples originales del cuestionario (solo catálogo activo); no reemplazan tablas estructuradas.",
    "structured_offer_items es el inventario canónico de oferta; no pidas repetir inventario que ya conste ahí.",
    "structured_audience_territories es la fuente canónica de audiencias/territorios; no pidas datos que ya estén allí.",
    "offer_nature vive en brand_offer_profile; no la infieras desde brand_responses.",
    "Las mejoras aprobadas previas son curaduría humana/IA: no sobrescriben brand_responses; proponé texto mejorado en proposed_changes.",
  ];
  if (SECTION_KEYS_WITH_STRUCTURAL_OFFER_CONTEXT.has(sectionKey)) {
    parts.push(
      "Esta sección se apoya en inventario de oferta: priorizá coherencia con structured_offer_items.",
    );
  }
  if (SECTION_KEYS_WITH_STRUCTURAL_TERRITORY_CONTEXT.has(sectionKey)) {
    parts.push(
      "Esta sección se apoya en territorios/audiencias: priorizá structured_audience_territories.",
    );
  }
  if (sectionKey === "brand_limbic_base") {
    parts.push(
      "Base Límbica: mejorá señales simbólicas (atmósfera, ritmo, sensibilidad, códigos expresivos); no escribas slogans ni copy literal para publicar.",
    );
  }
  return parts.join(" ");
}

export function normalizeDiagnosisSectionForImprovement(
  row: BrandDiagnosisSectionScoreParsed | null,
): BrandDiagnosisSectionScoreParsed | null {
  if (!row) return null;
  return {
    ...row,
    depth_opportunities: row.depth_opportunities ?? [],
  };
}

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
  /** Etiqueta humana (no mostrar section_key al usuario como título principal). */
  section_label: string;
  brand: BrandSectionImprovementContextBrand;
  brand_offer_profile: { offer_nature: BrandOfferNature };
  structured_offer_items: BrandDiagnosisStructuredOfferItemEntry[];
  structured_audience_territories: BrandDiagnosisStructuredAudienceTerritoryEntry[];
  /** Contexto estructurado relevante según la sección (evita pedir datos ya inventariados). */
  structured_context_note: string;
  scoring_policy: typeof BRAND_DIAGNOSIS_SCORING_POLICY_V2;
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
  const diagnosisSectionRaw = sectionScores.find((s) => s.section_key === sectionKey) ?? null;
  const diagnosisSection = normalizeDiagnosisSectionForImprovement(diagnosisSectionRaw);

  const [{ data: responses, error: rErr }, { data: offerItemRows, error: offerErr }, { data: territoryRows, error: terrErr }] =
    await Promise.all([
      supabase
        .from("brand_responses")
        .select(
          "id, brand_id, question_definition_id, section_key, module_key, question_key, answer_value, answer_text, answer_type, is_required, is_sensitive, source_type, created_at, updated_at",
        )
        .eq("brand_id", brandId)
        .eq("section_key", sectionKey),
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

  const allSectionResponses = (responses ?? []) as BrandResponseRow[];
  const responseRows = filterBrandResponsesForActiveDefinitions(allSectionResponses, definitions);

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
      .select(
        "section_key, module_key, question_key, question_definition_id, answer_text, answer_value, is_sensitive",
      )
      .eq("brand_id", brandId)
      .in("section_key", [...coherenceKeys]);

    if (!cErr && cohResp) {
      const defByKey = new Map(
        (definitions as QuestionDefinitionRow[]).map((d) => [d.question_key, d]),
      );
      for (const row of filterBrandResponsesForActiveDefinitions(
        cohResp as BrandResponseRow[],
        definitions,
      )) {
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

  const structured_context_note = structuredSourcesGuidanceForImproveSection(sectionKey);

  const context: BrandSectionImprovementContextPayload = {
    context_version: BRAND_SECTION_IMPROVE_CONTEXT_VERSION,
    section_key: sectionKey,
    section_label: brandQuestionnaireSectionLabelEs(sectionKey),
    brand,
    brand_offer_profile: { offer_nature: offerNature },
    structured_offer_items: structuredOfferItems,
    structured_audience_territories: structuredTerritories,
    structured_context_note,
    scoring_policy: BRAND_DIAGNOSIS_SCORING_POLICY_V2,
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
