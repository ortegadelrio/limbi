import { BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION } from "@/lib/schemas/brand-document-analysis";
import type { BrandDocumentType, BrandOfferNature, BrandResponseRow } from "@/types/database";
import type { QuestionDefinitionRow } from "@/types/database";
import {
  BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION,
  BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL,
} from "@/lib/brands/brand-document-analysis-limits";

type ApprovedFactSummary = {
  section_key: string;
  proposed_inclusion: string;
};

type BatchFindingSummary = {
  section_key: string;
  proposed_inclusion: string;
};

export type StructuredOfferItemPayload = {
  item_type: string;
  title: string;
  description: string | null;
};

export type StructuredTerritoryPayload = {
  territory_type: string;
  name: string;
};

export function buildBrandDocumentAnalysisUserContent(args: {
  brandName: string;
  offerNature: BrandOfferNature;
  document: {
    id: string;
    file_name: string;
    document_type: BrandDocumentType;
  };
  documentText: string;
  definitions: QuestionDefinitionRow[];
  responses: BrandResponseRow[];
  structuredOfferItems: StructuredOfferItemPayload[];
  structuredTerritories: StructuredTerritoryPayload[];
  approvedFactSummaries: ApprovedFactSummary[];
  batchFindingsSoFar: BatchFindingSummary[];
  remainingTotal: number;
  remainingBySection: Record<string, number>;
}): string {
  const defPayload = args.definitions.map((d) => ({
    section_key: d.section_key,
    module_key: d.module_key,
    question_key: d.question_key,
    question_text: d.question_text,
  }));

  const respPayload = args.responses.map((r) => ({
    section_key: r.section_key,
    module_key: r.module_key,
    question_key: r.question_key,
    answer_text: r.answer_text,
    answer_value: r.answer_value,
  }));

  const offerPayload = args.structuredOfferItems.map((it) => ({
    item_type: it.item_type,
    title: it.title,
    description: it.description,
  }));

  const territoryPayload = args.structuredTerritories.map((t) => ({
    territory_type: t.territory_type,
    name: t.name,
  }));

  return [
    `PROMPT_VERSION: ${BRAND_DOCUMENT_ANALYSIS_PROMPT_VERSION}`,
    `MARCA: ${JSON.stringify({ name: args.brandName, offer_nature: args.offerNature })}`,
    "MODELO_DE_DATOS_JOURNEY_MARCA: offer_nature vive en brand_offer_profiles (ya reflejado en offer_nature arriba). Las respuestas simples del cuestionario están en RESPUESTAS_CUESTIONARIO (brand_responses). El inventario de productos/servicios/líneas ofrecidas lo diligencia el usuario en brand_offer_items (no aparece en RESPUESTAS_CUESTIONARIO). Los territorios, mercados o comunidades geográficas/culturales lo diligencia el usuario en brand_audience_territories. Este análisis solo crea filas revisables en brand_source_facts: NUNCA insertes en brand_responses, brand_offer_items ni brand_audience_territories.",
    `OFERTA_ESTRUCTURADA_USUARIO (JSON; deduplicar, no copiar como si fuera nueva si ya está): ${JSON.stringify(offerPayload)}`,
    `TERRITORIOS_ESTRUCTURADOS_USUARIO (JSON; deduplicar igual): ${JSON.stringify(territoryPayload)}`,
    `DOCUMENTO_ACTUAL: ${JSON.stringify(args.document)}`,
    `LIMITES_EN_ESTE_LOTE: total_restante=${args.remainingTotal}, max_por_seccion=${BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION}, max_total_batch=${BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL}. Restante por sección (aprox): ${JSON.stringify(args.remainingBySection)}`,
    "Debes incluir en el JSON el campo analysis_result: usa \"no_useful_findings\" solo cuando no haya ningún hallazgo útil, verificable y estratégico (en ese caso findings = []). Usa \"findings_found\" cuando sí aportes al menos un hallazgo que cumpla criterios.",
    `DEFINICIONES_PERMITIDAS (JSON; cada hallazgo debe usar exactamente estas section_key / module_key / question_key cuando question_key no sea null):`,
    JSON.stringify(defPayload),
    `RESPUESTAS_CUESTIONARIO (JSON):`,
    JSON.stringify(respPayload),
    "Instrucción de redacción: para hallazgos con relationship_type complements o reinforces, existing_response_summary debe reflejar con fidelidad la respuesta del usuario en RESPUESTAS_CUESTIONARIO para esa pregunta (cuando exista) y proposed_inclusion debe integrar esa base con el aporte del documento, sin sustituirla por un extracto aislado.",
    "Criterio contradicts: reserva relationship_type = contradicts solo para tensiones factuales explícitas que no puedan convivir sin decisión humana (p. ej. cifras distintas). Si el documento solo amplía audiencia, alcance o matiz sin exclusión, usa complements u otro tipo coherente.",
    `FACTS_APROBADOS_PREVIOS (JSON, no duplicar): ${JSON.stringify(args.approvedFactSummaries)}`,
    `HALLAZGOS_YA_PROPUESTOS_EN_ESTE_LOTE (JSON, no duplicar): ${JSON.stringify(args.batchFindingsSoFar)}`,
    "TEXTO_DEL_DOCUMENTO (única fuente de evidencia; no inventes páginas ni datos fuera de este bloque):",
    "<<<DOCUMENT_TEXT>>>",
    args.documentText,
    "<<<END_DOCUMENT_TEXT>>>",
  ].join("\n\n");
}
