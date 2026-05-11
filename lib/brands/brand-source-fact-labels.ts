import type {
  BrandSourceFactRelationshipType,
  BrandSourceFactType,
} from "@/types/database";

/** Etiqueta visible para `relationship_type` en la bandeja de hallazgos. */
export function brandSourceFactRelationshipLabelEs(
  t: BrandSourceFactRelationshipType,
): string {
  switch (t) {
    case "new":
      return "Nuevo";
    case "complements":
      return "Complementa";
    case "reinforces":
      return "Refuerza";
    case "contradicts":
      return "Requiere revisión";
    default:
      return t;
  }
}

/** Etiqueta visible para `fact_type` en la bandeja de hallazgos. */
export function brandSourceFactTypeLabelEs(t: BrandSourceFactType): string {
  switch (t) {
    case "identity":
      return "Identidad";
    case "audience":
      return "Audiencia";
    case "value_proposition":
      return "Propuesta de valor";
    case "differentiator":
      return "Diferencial";
    case "evidence":
      return "Evidencia";
    case "tone":
      return "Voz y tono";
    case "restriction":
      return "Restricción";
    case "limbic_signal":
      return "Señal límbica";
    case "offer_detail":
      return "Detalle de oferta";
    case "positioning":
      return "Posicionamiento";
    case "purpose":
      return "Propósito";
    case "approved_message":
      return "Mensaje aprobado";
    case "other":
      return "Otro";
    default:
      return t;
  }
}
