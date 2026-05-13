import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandAudienceTerritoryRow,
  BrandAudienceTerritoryType,
  BrandOfferItemRow,
  BrandOfferItemType,
  BrandOfferNature,
  BrandRow,
  BrandSectionImprovementRow,
  BrandSourceFactRow,
  BrandResponseRow,
  QuestionDefinitionRow,
} from "@/types/database";
import { fetchAllowedBrandQuestionDefinitions } from "@/lib/questions/fetch-allowed-brand-questions";
import { groupBrandQuestionDefinitionsBySection } from "@/lib/questions/get-brand-question-definitions";

export const BRAND_DIAGNOSIS_CONTEXT_VERSION = "brand-diagnosis-context-v2.0";

/** Secciones operativas que no entran al diagnóstico estratégico. */
const EXCLUDED_DIAGNOSIS_SECTIONS = new Set(["material_context"]);

/** Secciones donde el inventario en `brand_offer_items` cuenta como evidencia estructural principal. */
const SECTION_KEYS_WITH_STRUCTURAL_OFFER_SIGNAL = new Set<string>([
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

/** Sección donde `brand_audience_territories` es fuente canónica de audiencias/territorios. */
const SECTION_KEYS_WITH_STRUCTURAL_TERRITORY_SIGNAL = new Set<string>(["audiences"]);

export const BRAND_DIAGNOSIS_SCORING_POLICY_V2 = {
  version: "brand-diagnosis-scoring-v2.0",
  notes: [
    "Ponderá principalmente preguntas obligatorias (is_required=true en question_definitions) y datos estructurados esenciales según brand_offer_profile.offer_nature.",
    "Los arreglos structured_offer_items y structured_audience_territories son fuentes canónicas de inventario de oferta y de territorios/audiencias: no busques esa evidencia principalmente en brand_responses ni en preguntas inactivas.",
    "brand_offer_profile.offer_nature define la naturaleza de la oferta; no la infieras desde brand_responses.",
    "Las preguntas opcionales sin respuesta no deben castigar duramente el score ni generar sensación de fracaso: la profundización opcional suma contexto, no bloquea por sí sola.",
    "Las tensiones, límites, tonos a evitar o formulaciones tipo «no quiero que piensen…» son restricciones o alertas estratégicas: no las conviertas en atributos positivos de posicionamiento.",
    "En brand_limbic_base, las señales (limbic_emotional_temperature, limbic_energy_movement, limbic_visual_atmosphere, limbic_emotional_colors, limbic_expressive_codes) se interpretan en clave simbólica (atmósfera, ritmo, sensibilidad, energía, personalidad, códigos de expresión), no como claims literales ni copy final.",
    "Si el score global o por sección ronda 70% o más, comunicá que hay base suficiente para avanzar y que las mejoras son refinamientos, salvo vacíos obligatorios claros o contradicciones fuertes.",
  ],
} as const;

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

export type BrandDiagnosisApprovedImprovementChangeEntry = {
  question_key: string;
  question_text: string;
  current_summary: string;
  proposed_improved_text: string;
  rationale: string;
  confidence: string;
};

/** Mejora por sección aprobada y activa (Ticket 5), para el próximo diagnóstico. */
export type BrandDiagnosisApprovedSectionImprovementEntry = {
  improvement_id: string;
  section_key: string;
  session_id: string | null;
  approved_at: string;
  improved_summary: string;
  improved_fields: BrandDiagnosisApprovedImprovementChangeEntry[];
  proposed_changes: BrandDiagnosisApprovedImprovementChangeEntry[];
  remaining_gaps: { gap: string; why_it_matters: string }[];
};

export type BrandDiagnosisStructuredOfferItemEntry = {
  item_type: BrandOfferItemType;
  title: string;
  description: string | null;
};

export type BrandDiagnosisStructuredAudienceTerritoryEntry = {
  territory_type: BrandAudienceTerritoryType;
  name: string;
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
  structured_offer_items: BrandDiagnosisStructuredOfferItemEntry[];
  structured_audience_territories: BrandDiagnosisStructuredAudienceTerritoryEntry[];
  scoring_policy: typeof BRAND_DIAGNOSIS_SCORING_POLICY_V2;
  approved_source_facts: BrandDiagnosisApprovedFactEntry[];
  /** Solo `approved` + `is_active`; no borradores ni superseded. */
  approved_section_improvements: BrandDiagnosisApprovedSectionImprovementEntry[];
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

/**
 * Respuestas alineadas al catálogo activo: conserva filas con `question_definition_id` vigente y
 * **re-enlaza por `question_key`** cuando el id apunta a una definición inactiva/reemplazada (Ticket
 * B u otros cambios de catálogo), deduplicando por `question_key` (máx. `updated_at`).
 */
export function filterBrandResponsesForActiveDefinitions(
  responses: BrandResponseRow[],
  definitions: QuestionDefinitionRow[],
): BrandResponseRow[] {
  const defIds = new Set(definitions.map((d) => d.id));
  const defByKey = new Map<string, QuestionDefinitionRow>();
  for (const d of definitions) {
    if (!defByKey.has(d.question_key)) defByKey.set(d.question_key, d);
  }

  const resolveRow = (r: BrandResponseRow): BrandResponseRow | null => {
    if (defIds.has(r.question_definition_id)) return r;
    const canon = defByKey.get(r.question_key);
    if (!canon) return null;
    return {
      ...r,
      question_definition_id: canon.id,
      section_key: canon.section_key,
      module_key: canon.module_key,
      question_key: canon.question_key,
      answer_type: canon.answer_type,
      is_required: canon.is_required,
      is_sensitive: canon.is_sensitive,
    };
  };

  const byKey = new Map<string, BrandResponseRow>();
  for (const r of responses) {
    const row = resolveRow(r);
    if (!row) continue;
    const prev = byKey.get(row.question_key);
    if (!prev) {
      byKey.set(row.question_key, row);
      continue;
    }
    const prevTs = String(prev.updated_at ?? prev.created_at ?? "");
    const curTs = String(row.updated_at ?? row.created_at ?? "");
    const preferCurrent =
      curTs > prevTs ||
      (defIds.has(row.question_definition_id) && !defIds.has(prev.question_definition_id));
    byKey.set(row.question_key, preferCurrent ? row : prev);
  }
  return [...byKey.values()];
}

export function buildCoverage(
  definitions: QuestionDefinitionRow[],
  responses: BrandResponseRow[],
  facts: BrandSourceFactRow[],
  strategicSectionKeys: string[],
  structuredOfferItemCount: number,
  structuredTerritoryCount: number,
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
    const hasStructuralOffer =
      structuredOfferItemCount > 0 && SECTION_KEYS_WITH_STRUCTURAL_OFFER_SIGNAL.has(section_key);
    const hasStructuralTerritories =
      structuredTerritoryCount > 0 &&
      SECTION_KEYS_WITH_STRUCTURAL_TERRITORY_SIGNAL.has(section_key);
    const appears_empty =
      !hasResponseContent &&
      approvedFactsCount === 0 &&
      !hasStructuralOffer &&
      !hasStructuralTerritories;

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

/** Huella de respuesta para hash (incluye contenido; no duplicar texto largo en snapshot). */
function brandResponseAnswerDigest(r: BrandResponseRow): string {
  const t = (r.answer_text ?? "").trim();
  let vNorm = "";
  try {
    vNorm = JSON.stringify(r.answer_value ?? null);
  } catch {
    vNorm = "null";
  }
  return createHash("sha256")
    .update(r.question_key)
    .update("\0")
    .update(r.question_definition_id)
    .update("\0")
    .update(t)
    .update("\0")
    .update(vNorm)
    .digest("hex");
}

/** Metadatos para `source_snapshot` (sin texto sensible ni duplicar cuestionario completo). */
export function buildBrandDiagnosisSourceSnapshot(args: {
  strategicSectionKeys: string[];
  offerNature: BrandOfferNature;
  promptVersion: string;
  definitionsCount: number;
  responses: BrandResponseRow[];
  approvedFactsCount: number;
  approvedFactsDigest: string;
  approvedSectionImprovements: BrandDiagnosisApprovedSectionImprovementEntry[];
  approvedSectionImprovementsDigest: string;
  structuredOfferItemCount: number;
  structuredAudienceTerritoryCount: number;
  structuredOfferItems: BrandDiagnosisStructuredOfferItemEntry[];
  structuredAudienceTerritories: BrandDiagnosisStructuredAudienceTerritoryEntry[];
}): Record<string, unknown> {
  const responsesMeta = args.responses.map((r) => ({
    section_key: r.section_key,
    question_key: r.question_key,
    question_definition_id: r.question_definition_id,
    is_required: r.is_required,
    is_sensitive: r.is_sensitive,
    has_text: (r.answer_text ?? "").trim().length > 0,
    answer_text_len: (r.answer_text ?? "").length,
    answer_digest: brandResponseAnswerDigest(r),
  }));

  const structuredOfferDigest = createHash("sha256")
    .update(
      args.structuredOfferItems
        .map((i) => `${i.item_type}\t${i.title}\t${(i.description ?? "").slice(0, 800)}`)
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 48);

  const structuredTerritoryDigest = createHash("sha256")
    .update(
      args.structuredAudienceTerritories.map((t) => `${t.territory_type}\t${t.name}`).join("\n"),
    )
    .digest("hex")
    .slice(0, 48);

  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        strategic_section_keys: args.strategicSectionKeys,
        offer_nature: args.offerNature,
        prompt_version: args.promptVersion,
        definitions_count: args.definitionsCount,
        responses_meta: responsesMeta,
        approved_facts_count: args.approvedFactsCount,
        approved_facts_digest: args.approvedFactsDigest,
        approved_section_improvements_digest: args.approvedSectionImprovementsDigest,
        structured_offer_item_count: args.structuredOfferItemCount,
        structured_audience_territory_count: args.structuredAudienceTerritoryCount,
        structured_offer_digest: structuredOfferDigest,
        structured_audience_territory_digest: structuredTerritoryDigest,
        approved_section_improvements_meta: args.approvedSectionImprovements.map((i) => ({
          improvement_id: i.improvement_id,
          section_key: i.section_key,
          approved_at: i.approved_at,
          proposed_changes_count: i.proposed_changes.length,
          remaining_gaps_count: i.remaining_gaps.length,
        })),
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
    approved_facts_digest: args.approvedFactsDigest,
    structured_offer_item_count: args.structuredOfferItemCount,
    structured_audience_territory_count: args.structuredAudienceTerritoryCount,
    structured_offer_digest: structuredOfferDigest,
    structured_audience_territory_digest: structuredTerritoryDigest,
    approved_section_improvements_count: args.approvedSectionImprovements.length,
    approved_section_improvements_digest: args.approvedSectionImprovementsDigest,
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
      approvedSectionImprovements: BrandSectionImprovementRow[];
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
  const allResponses = (responseRows ?? []) as BrandResponseRow[];
  const responses = filterBrandResponsesForActiveDefinitions(allResponses, definitions);

  const [{ data: factRows, error: factErr }, { data: offerItemRows, error: offerErr }, { data: territoryRows, error: terrErr }] =
    await Promise.all([
      supabase
        .from("brand_source_facts")
        .select(
          "id, brand_id, source_type, brand_document_id, brand_document_extraction_id, analysis_batch_id, analysis_run_id, section_key, module_key, question_key, relationship_type, fact_type, source_excerpt, source_reference, source_document_name, supporting_documents, extracted_fact, ai_interpretation, existing_response_summary, proposed_inclusion, user_edited_text, status, rejection_reason, confidence_score, dedupe_fingerprint, sort_order, created_at, updated_at, reviewed_at",
        )
        .eq("brand_id", brandId)
        .eq("status", "approved"),
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

  if (factErr) {
    return { ok: false, code: "facts_error", message: factErr.message };
  }
  if (offerErr) {
    return { ok: false, code: "offer_items_error", message: offerErr.message };
  }
  if (terrErr) {
    return { ok: false, code: "territories_error", message: terrErr.message };
  }
  const approvedFacts = (factRows ?? []) as BrandSourceFactRow[];

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

  const structuredOfferItemCount = structuredOfferItems.filter((i) => i.title.length > 0).length;
  const structuredTerritoryCount = structuredTerritories.filter((t) => t.name.length > 0).length;

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

  const coverage = buildCoverage(
    definitions,
    responses,
    approvedFacts,
    strategicSectionKeys,
    structuredOfferItemCount,
    structuredTerritoryCount,
  );

  const { data: improvementRows, error: impErr } = await supabase
    .from("brand_section_improvements")
    .select(
      "id, brand_id, section_key, session_id, status, is_active, payload, approved_at, superseded_at, created_at, updated_at",
    )
    .eq("brand_id", brandId)
    .eq("status", "approved")
    .eq("is_active", true);

  if (impErr) {
    return { ok: false, code: "improvements_error", message: impErr.message };
  }
  const approvedSectionImprovementRows = (improvementRows ?? []) as BrandSectionImprovementRow[];

  const approvedSectionImprovementEntries = buildApprovedSectionImprovementEntries(
    approvedSectionImprovementRows,
    definitions,
  );

  const context: BrandDiagnosisEvaluationContext = {
    context_version: BRAND_DIAGNOSIS_CONTEXT_VERSION,
    brand,
    brand_offer_profile: { offer_nature: offerNature },
    question_definitions: defEntries,
    brand_responses: respEntries,
    structured_offer_items: structuredOfferItems,
    structured_audience_territories: structuredTerritories,
    scoring_policy: BRAND_DIAGNOSIS_SCORING_POLICY_V2,
    approved_source_facts: factEntries,
    approved_section_improvements: approvedSectionImprovementEntries,
    section_coverage_summary: coverage,
  };

  const approvedFactsDigest = createHash("sha256")
    .update(
      factEntries
        .map((f) =>
          [
            f.section_key,
            f.module_key ?? "",
            f.question_key ?? "",
            (f.usable_text ?? "").slice(0, 800),
          ].join("\t"),
        )
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 48);

  const approvedSectionImprovementsDigest = createHash("sha256")
    .update(
      approvedSectionImprovementEntries
        .map((i) =>
          [
            i.improvement_id,
            (i.improved_summary ?? "").slice(0, 800),
            i.proposed_changes.map((c) => (c.proposed_improved_text ?? "").slice(0, 400)).join("|"),
            i.remaining_gaps.map((g) => `${g.gap}\t${g.why_it_matters}`).join("|"),
          ].join("\n"),
        )
        .join("\n\n"),
    )
    .digest("hex")
    .slice(0, 48);

  const sourceSnapshot = buildBrandDiagnosisSourceSnapshot({
    strategicSectionKeys,
    offerNature,
    promptVersion,
    definitionsCount: defEntries.length,
    responses,
    approvedFactsCount: factEntries.length,
    approvedFactsDigest,
    approvedSectionImprovements: approvedSectionImprovementEntries,
    approvedSectionImprovementsDigest,
    structuredOfferItemCount,
    structuredAudienceTerritoryCount: structuredTerritoryCount,
    structuredOfferItems,
    structuredAudienceTerritories: structuredTerritories,
  });

  return {
    ok: true,
    offerNature,
    strategicSectionKeys,
    context,
    sourceSnapshot,
    responses,
    approvedFacts,
    approvedSectionImprovements: approvedSectionImprovementRows,
  };
}

function buildApprovedSectionImprovementEntries(
  rows: BrandSectionImprovementRow[],
  definitions: QuestionDefinitionRow[],
): BrandDiagnosisApprovedSectionImprovementEntry[] {
  const qTextByKey = new Map(
    definitions.map((d) => [d.question_key, d.question_text.trim()]),
  );
  const out: BrandDiagnosisApprovedSectionImprovementEntry[] = [];
  for (const row of rows) {
    if (EXCLUDED_DIAGNOSIS_SECTIONS.has(row.section_key)) continue;
    const approvedAt = row.approved_at;
    if (!approvedAt) continue;
    const payload = row.payload as Record<string, unknown> | null;
    const raw = payload?.proposed_changes;
    if (!Array.isArray(raw)) continue;
    const proposed_changes: BrandDiagnosisApprovedImprovementChangeEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const qk = typeof o.question_key === "string" ? o.question_key : "";
      if (!qk) continue;
      proposed_changes.push({
        question_key: qk,
        question_text: qTextByKey.get(qk) ?? "",
        current_summary: String(o.current_summary ?? ""),
        proposed_improved_text: String(o.proposed_improved_text ?? ""),
        rationale: String(o.rationale ?? ""),
        confidence: String(o.confidence ?? ""),
      });
    }
    if (proposed_changes.length === 0) continue;
    const remainingGapsRaw = payload?.remaining_gaps;
    const remaining_gaps = Array.isArray(remainingGapsRaw)
      ? remainingGapsRaw
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const o = item as Record<string, unknown>;
            return {
              gap: String(o.gap ?? ""),
              why_it_matters: String(o.why_it_matters ?? ""),
            };
          })
          .filter(
            (g): g is { gap: string; why_it_matters: string } =>
              Boolean(g && (g.gap.trim() || g.why_it_matters.trim())),
          )
      : [];
    out.push({
      improvement_id: row.id,
      section_key: row.section_key,
      session_id: row.session_id,
      approved_at: approvedAt,
      improved_summary: String(payload?.assistant_message ?? ""),
      improved_fields: proposed_changes,
      proposed_changes,
      remaining_gaps,
    });
  }
  return out;
}

/** Mínimo: respuesta con contenido, fact aprobado, mejora aprobada con cambios, o datos estructurados de oferta/territorio con título/nombre. */
export function hasMinimumInputForDiagnosis(
  responses: BrandResponseRow[],
  approvedFactsCount: number,
  approvedSectionImprovementsWithChanges = 0,
  opts?: { structuredOfferItemCount?: number; structuredTerritoryCount?: number },
): boolean {
  const offerN = opts?.structuredOfferItemCount ?? 0;
  const terrN = opts?.structuredTerritoryCount ?? 0;
  if (approvedFactsCount > 0) return true;
  if (approvedSectionImprovementsWithChanges > 0) return true;
  if (offerN > 0 || terrN > 0) return true;
  return responses.some(
    (r) => !EXCLUDED_DIAGNOSIS_SECTIONS.has(r.section_key) && responseHasContent(r),
  );
}
