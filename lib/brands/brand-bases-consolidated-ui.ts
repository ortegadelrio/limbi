import { BRAND_BASE_UI_SECTIONS } from "@/lib/brands/brand-base-display-sections";
import { brandQuestionnaireSectionLabelEs } from "@/lib/brands/questionnaire-section-labels";

/**
 * Modelo de **presentación** para humanos a partir del JSON consolidado.
 * `buildBrandKnowledgeUiModel` resume y ordena; **no** reemplaza al `consolidated_payload` guardado
 * en `brand_knowledge_bases` para consumo de IA (ver `loadActiveBrandContextForProject`).
 */
export const BRAND_BASES_EXECUTIVE_DISCLAIMER_ES =
  "Por sección verás lo que consolidamos del cuestionario (información de marca) y la lectura estratégica de Limbi. La base completa sigue guardada y es la fuente operativa para proyectos y Brainstormer.";

export const BRAND_BASES_LEGACY_SECTION_INFO_NOTE_ES =
  "Esta consolidación no separó aún la información del cuestionario. Regenerá la Base de Marca para ver ambas capas con el formato actual.";

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
  brandInformation: string;
  limbiReading: string;
  /** True si `brandInformation` proviene de un fallback estructurado (bases v1.0–v1.2). */
  brandInformationDerived: boolean;
};

export type BrandBaseSectionView = {
  id: string;
  label: string;
  headline: string | null;
  brandInformation: string | null;
  limbiReading: string | null;
  brandInformationDerived: boolean;
  offerCatalog: BrandOfferServiceCatalogEntryUi[] | null;
  credibilityFactGroups: { title: string; items: string[] }[] | null;
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
    const brandInformation = asString(r.brand_information).trim();
    const limbiReading = asString(r.interpretation).trim();
    if (!section_key || !limbiReading) continue;
    out.push({
      section_key,
      headline: headline || brandQuestionnaireSectionLabelEs(section_key),
      brandInformation,
      limbiReading,
      brandInformationDerived: false,
    });
  }
  return out;
}

function formatOfferCatalogAsBrandInformation(
  summary: string,
  catalog: BrandOfferServiceCatalogEntryUi[],
): string {
  const parts: string[] = [];
  if (summary.trim()) parts.push(summary.trim());
  if (catalog.length > 0) {
    const lines = catalog.map((row) => {
      const desc = row.description.trim();
      return desc.length > 0 ? `• ${row.name}: ${desc}` : `• ${row.name}`;
    });
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n").trim();
}

function formatCredibilityAsBrandInformation(
  c: BrandCredibilityArchitectureUi,
): string {
  const groups: { title: string; items: string[] }[] = [
    { title: "Señales de autoridad", items: c.authority_signals },
    { title: "Roles institucionales", items: c.institutional_roles },
    { title: "Liderazgo en el sector", items: c.industry_leadership_assets },
    { title: "Credenciales del fundador/a", items: c.founder_credentials },
    { title: "Ecosistema de negocios", items: c.business_ecosystem },
    { title: "Prueba reputacional", items: c.reputation_proof_points },
  ];
  const parts: string[] = [];
  for (const g of groups) {
    if (g.items.length === 0) continue;
    parts.push(`${g.title}:\n${g.items.map((x) => `• ${x}`).join("\n")}`);
  }
  return parts.join("\n\n").trim();
}

function credibilityFactGroups(
  c: BrandCredibilityArchitectureUi | null,
): { title: string; items: string[] }[] | null {
  if (!c) return null;
  const groups = [
    { title: "Señales de autoridad", items: c.authority_signals },
    { title: "Roles institucionales", items: c.institutional_roles },
    { title: "Liderazgo en el sector", items: c.industry_leadership_assets },
    { title: "Credenciales del fundador/a", items: c.founder_credentials },
    { title: "Ecosistema de negocios", items: c.business_ecosystem },
    { title: "Prueba reputacional", items: c.reputation_proof_points },
  ].filter((g) => g.items.length > 0);
  return groups.length > 0 ? groups : null;
}

function deriveBrandInformationFallback(
  sectionId: string,
  payload: Record<string, unknown>,
  offerArchitecture: BrandOfferArchitectureUi | null,
  credibilityArchitecture: BrandCredibilityArchitectureUi | null,
): string {
  if (sectionId === "offer" && offerArchitecture) {
    return formatOfferCatalogAsBrandInformation(
      offerArchitecture.offer_summary,
      offerArchitecture.service_catalog,
    );
  }
  if (sectionId === "evidence" && credibilityArchitecture) {
    return formatCredibilityAsBrandInformation(credibilityArchitecture);
  }
  if (sectionId === "restrictions") {
    const r = asString(payload.restrictions_and_alerts).trim();
    if (r) return r;
  }
  return "";
}

function findInterpretationForKeys(
  rows: BrandSectionInterpretationUi[],
  keys: string[],
): BrandSectionInterpretationUi | null {
  for (const key of keys) {
    const row = rows.find((r) => r.section_key === key);
    if (row) return row;
  }
  return null;
}

/**
 * Vistas por sección de producto para `/bases` (dos capas: información + lectura Limbi).
 */
export function buildBrandBaseSectionViews(
  knowledgeUi: BrandKnowledgeUiModel,
): BrandBaseSectionView[] {
  const rows = knowledgeUi.sectionInterpretations;
  const payloadLike = {
    restrictions_and_alerts: knowledgeUi.restrictionsAndAlerts,
  };

  return BRAND_BASE_UI_SECTIONS.map((def) => {
    const match = findInterpretationForKeys(rows, def.interpretationKeys);
    let brandInformation = match?.brandInformation?.trim() ?? "";
    let limbiReading = match?.limbiReading?.trim() ?? "";
    let derived = match?.brandInformationDerived ?? false;

    if (!brandInformation) {
      const fallback = deriveBrandInformationFallback(
        def.id,
        payloadLike,
        def.id === "offer" ? knowledgeUi.offerArchitecture : null,
        def.id === "evidence" ? knowledgeUi.credibilityArchitecture : null,
      );
      if (fallback) {
        brandInformation = fallback;
        derived = true;
      }
    }

    const offerCatalog =
      def.id === "offer" && knowledgeUi.offerArchitecture?.service_catalog.length
        ? knowledgeUi.offerArchitecture.service_catalog
        : null;

    const credGroups =
      def.id === "evidence"
        ? credibilityFactGroups(knowledgeUi.credibilityArchitecture)
        : null;

    if (def.id === "offer" && knowledgeUi.offerArchitecture?.commercial_use_guidance) {
      const guidance = knowledgeUi.offerArchitecture.commercial_use_guidance.trim();
      limbiReading = limbiReading
        ? `${limbiReading}\n\n${guidance}`
        : guidance;
    }

    if (def.id === "evidence" && knowledgeUi.credibilityArchitecture) {
      const guidance = knowledgeUi.credibilityArchitecture.communication_use_guidance.trim();
      if (guidance && !limbiReading.includes(guidance)) {
        limbiReading = limbiReading ? `${limbiReading}\n\n${guidance}` : guidance;
      }
    }

    return {
      id: def.id,
      label: def.label,
      headline: match?.headline ?? null,
      brandInformation: brandInformation || null,
      limbiReading: limbiReading || null,
      brandInformationDerived: derived,
      offerCatalog,
      credibilityFactGroups: credGroups,
    };
  }).filter(
    (s) =>
      Boolean(s.brandInformation?.trim()) ||
      Boolean(s.limbiReading?.trim()) ||
      (s.offerCatalog?.length ?? 0) > 0,
  );
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
