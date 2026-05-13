/** Copy y reglas de deshabilitado para Material de contexto (Ticket H.2). Usado en `brand-documents-client` y en tests. */

export const BRAND_MATERIAL_WEB_SECTION_HEADING = "Sitio web de la marca";

export const BRAND_MATERIAL_WEB_HELP_ES =
  "Limbi leerá algunas páginas públicas del mismo dominio y propondrá hallazgos para tu revisión.";

export const BRAND_MATERIAL_WEB_PENDING_REVIEW_BLOCK_ES =
  "Primero revisa los hallazgos pendientes antes de explorar otro sitio.";

export const BRAND_MATERIAL_WEB_URL_PLACEHOLDER = "agenciapopuli.com";

export const BRAND_MATERIAL_SUBIR_ARCHIVO_SUBTITLE_ES =
  "PDF, Word (.docx) o texto plano (.txt).";

export type WebExploreDisableArgs = {
  hasPendingReview: boolean;
  analyzingDocuments: boolean;
  extractingId: string | null;
  uploading: boolean;
  webExploreBusy: boolean;
};

/** Bloqueos que deshabilitan URL + botón (no dependen de si hay texto en el campo). */
export function isWebExploreInteractionLocked(a: WebExploreDisableArgs): boolean {
  return (
    a.hasPendingReview ||
    a.analyzingDocuments ||
    a.extractingId !== null ||
    a.uploading ||
    a.webExploreBusy
  );
}

export function isWebExploreButtonDisabled(
  a: WebExploreDisableArgs,
  urlTrimmedEmpty: boolean,
): boolean {
  return isWebExploreInteractionLocked(a) || urlTrimmedEmpty;
}
