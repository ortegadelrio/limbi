import type {
  BrandDocumentProcessingStatus,
  BrandDocumentType,
} from "@/types/database";

const TYPE_LABELS: Record<BrandDocumentType, string> = {
  manual: "Manual de marca",
  brief: "Brief",
  deck: "Presentación / deck",
  portfolio: "Portafolio",
  study: "Estudio",
  strategy: "Documento estratégico",
  institutional: "Texto institucional",
  success_case: "Caso de éxito",
  other: "Otro",
};

export function brandDocumentTypeLabelEs(t: BrandDocumentType): string {
  return TYPE_LABELS[t] ?? t;
}

export function brandDocumentStatusLabelEs(
  s: BrandDocumentProcessingStatus,
): string {
  if (s === "pending") return "Subida no completada";
  if (s === "uploaded") return "Cargado · pendiente de lectura";
  if (s === "processing") return "Leyendo documento…";
  if (s === "ready") return "Texto extraído";
  if (s === "failed") return "Error";
  return s;
}

/** Etiqueta en listas de documentos (pending = subida no finalizada). */
export function brandDocumentListStatusLabelEs(
  s: BrandDocumentProcessingStatus,
): string {
  return brandDocumentStatusLabelEs(s);
}

export const BRAND_DOCUMENT_TYPE_OPTIONS: { value: BrandDocumentType; label: string }[] =
  (Object.keys(TYPE_LABELS) as BrandDocumentType[]).map((value) => ({
    value,
    label: TYPE_LABELS[value],
  }));
