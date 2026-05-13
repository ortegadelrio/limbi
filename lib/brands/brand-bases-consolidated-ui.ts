import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";

export const BRAND_BASES_EXECUTIVE_DISCLAIMER_ES =
  "Esta es una lectura ejecutiva de la Base de Marca. La base completa queda guardada internamente y será utilizada por Limbi para desarrollar proyectos, sistemas límbicos de proyecto y contenidos futuros con coherencia estratégica.";

/** Orden sugerido de secciones en la vista interpretativa (si el modelo devuelve otras, se muestran al final). */
export const BRAND_BASE_SECTION_DISPLAY_ORDER = [
  "identity",
  "offer",
  "audiences",
  "value_proposition",
  "differentiators",
  "evidence",
  "voice_tone",
  "restrictions",
] as const;

export type BrandFinalHighlightsUi = {
  key_strengths: string[];
  strategic_tensions: string[];
  communication_opportunities: string[];
  key_limbic_signals: string[];
  narrative_care_and_avoids: string[];
};

export type BrandSectionInterpretationUi = {
  section_key: string;
  headline: string;
  interpretation: string;
};

export type BrandCredibilityArchitectureUi = {
  authority_signals: string[];
  institutional_roles: string[];
  industry_leadership_assets: string[];
  founder_credentials: string[];
  business_ecosystem: string[];
  reputation_proof_points: string[];
  communication_use_guidance: string;
  cautions: string[];
};

export type BrandOfferServiceCatalogEntryUi = {
  name: string;
  item_type: string;
  description: string;
  strategic_role: string;
  main_value: string;
};

export type BrandOfferArchitectureUi = {
  offer_nature: string;
  offer_summary: string;
  service_catalog: BrandOfferServiceCatalogEntryUi[];
  commercial_use_guidance: string;
};

export type BrandKnowledgeUiModel = {
  executiveReading: string;
  sectionInterpretations: BrandSectionInterpretationUi[];
  finalHighlights: BrandFinalHighlightsUi | null;
  internalBaseNotice: string | null;
  projectReadinessMessage: string | null;
  curatorReading: string;
  strategicPillars: { title: string; body: string }[];
  restrictionsAndAlerts: string;
  evidenceNarrative: string;
  /** v1.1+ en payload consolidado; null en bases antiguas sin el bloque. */
  offerArchitecture: BrandOfferArchitectureUi | null;
  /** v1.2+ credibilidad y respaldo reputacional; null en consolidaciones previas. */
  credibilityArchitecture: BrandCredibilityArchitectureUi | null;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, max);
}

function parseFinalHighlights(raw: unknown): BrandFinalHighlightsUi | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key_strengths = asStringArray(o.key_strengths);
  const strategic_tensions = asStringArray(o.strategic_tensions);
  const communication_opportunities = asStringArray(o.communication_opportunities);
  const key_limbic_signals = asStringArray(o.key_limbic_signals);
  const narrative_care_and_avoids = asStringArray(o.narrative_care_and_avoids);
  if (
    key_strengths.length === 0 &&
    strategic_tensions.length === 0 &&
    communication_opportunities.length === 0 &&
    key_limbic_signals.length === 0 &&
    narrative_care_and_avoids.length === 0
  ) {
    return null;
  }
  return {
    key_strengths,
    strategic_tensions,
    communication_opportunities,
    key_limbic_signals,
    narrative_care_and_avoids,
  };
}

function parseSectionInterpretations(raw: unknown): BrandSectionInterpretationUi[] {
  if (!Array.isArray(raw)) return [];
  const out: BrandSectionInterpretationUi[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const section_key = asString(r.section_key).trim();
    const headline = asString(r.headline).trim();
    const interpretation = asString(r.interpretation).trim();
    if (!section_key || !interpretation) continue;
    out.push({
      section_key,
      headline: headline || brandQuestionnaireSectionLabelEs(section_key),
      interpretation,
    });
  }
  return out;
}

function parseOfferArchitecture(raw: unknown): BrandOfferArchitectureUi | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const offer_summary = asString(o.offer_summary).trim();
  const commercial_use_guidance = asString(o.commercial_use_guidance).trim();
  if (!offer_summary || !commercial_use_guidance) return null;
  const offer_nature = asString(o.offer_nature).trim();
  const catRaw = o.service_catalog;
  const service_catalog: BrandOfferServiceCatalogEntryUi[] = [];
  if (Array.isArray(catRaw)) {
    for (const row of catRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = asString(r.name).trim();
      if (!name) continue;
      service_catalog.push({
        name,
        item_type: asString(r.item_type).trim(),
        description: asString(r.description).trim(),
        strategic_role: asString(r.strategic_role).trim(),
        main_value: asString(r.main_value).trim(),
      });
    }
  }
  return {
    offer_nature,
    offer_summary,
    service_catalog,
    commercial_use_guidance,
  };
}

function parseCredibilityArchitecture(raw: unknown): BrandCredibilityArchitectureUi | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const communication_use_guidance = asString(o.communication_use_guidance).trim();
  if (!communication_use_guidance) return null;
  return {
    authority_signals: asStringArray(o.authority_signals, 30),
    institutional_roles: asStringArray(o.institutional_roles, 30),
    industry_leadership_assets: asStringArray(o.industry_leadership_assets, 30),
    founder_credentials: asStringArray(o.founder_credentials, 30),
    business_ecosystem: asStringArray(o.business_ecosystem, 30),
    reputation_proof_points: asStringArray(o.reputation_proof_points, 30),
    communication_use_guidance,
    cautions: asStringArray(o.cautions, 24),
  };
}

/** True si el payload incluye el bloque v1.2 (aunque los arrays estén vacíos). */
export function brandKnowledgeUiHasCredibilityBlock(
  c: BrandCredibilityArchitectureUi | null,
): c is BrandCredibilityArchitectureUi {
  return c != null;
}

function sortInterpretations(rows: BrandSectionInterpretationUi[]): BrandSectionInterpretationUi[] {
  const order = new Map(BRAND_BASE_SECTION_DISPLAY_ORDER.map((k, i) => [k, i]));
  return [...rows].sort((a, b) => {
    const ia = order.has(a.section_key as (typeof BRAND_BASE_SECTION_DISPLAY_ORDER)[number])
      ? order.get(a.section_key as (typeof BRAND_BASE_SECTION_DISPLAY_ORDER)[number])!
      : 999;
    const ib = order.has(b.section_key as (typeof BRAND_BASE_SECTION_DISPLAY_ORDER)[number])
      ? order.get(b.section_key as (typeof BRAND_BASE_SECTION_DISPLAY_ORDER)[number])!
      : 999;
    if (ia !== ib) return ia - ib;
    return a.section_key.localeCompare(b.section_key);
  });
}

/**
 * Normaliza el payload guardado (v1.0–v1.2) para la UI de `/bases`.
 */
export function buildBrandKnowledgeUiModel(payload: Record<string, unknown>): BrandKnowledgeUiModel {
  const p = payload;
  const curatorReading = asString(p.curator_reading);
  const executiveReading = asString(p.executive_reading).trim() || curatorReading;
  const pillarsRaw = p.strategic_pillars;
  const strategicPillars = Array.isArray(pillarsRaw)
    ? pillarsRaw
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const o = x as Record<string, unknown>;
          const title = asString(o.title).trim();
          const body = asString(o.body).trim();
          if (!title || !body) return null;
          return { title, body };
        })
        .filter((x): x is { title: string; body: string } => Boolean(x))
    : [];

  const sectionInterpretations = sortInterpretations(parseSectionInterpretations(p.section_interpretations));

  return {
    executiveReading,
    sectionInterpretations,
    finalHighlights: parseFinalHighlights(p.final_highlights),
    internalBaseNotice: (() => {
      const s = asString(p.internal_base_notice).trim();
      return s.length ? s : null;
    })(),
    projectReadinessMessage: (() => {
      const s = asString(p.project_readiness_message).trim();
      return s.length ? s : null;
    })(),
    curatorReading,
    strategicPillars,
    restrictionsAndAlerts: asString(p.restrictions_and_alerts),
    evidenceNarrative: asString(p.evidence_narrative),
    offerArchitecture: parseOfferArchitecture(p.offer_architecture),
    credibilityArchitecture: parseCredibilityArchitecture(p.credibility_architecture),
  };
}
