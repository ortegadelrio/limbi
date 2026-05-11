/** Máximo de hallazgos por sección en un análisis consolidado (Ticket 3B.3). */
export const BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION = 5;

/** Máximo de hallazgos en total por batch consolidado. */
export const BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL = 25;

/**
 * Caracteres máximos del texto del documento enviados al modelo en una sola llamada.
 * El texto completo sigue en DB; aquí solo acotamos el prompt.
 */
export const BRAND_DOCUMENT_ANALYSIS_MAX_DOC_TEXT_CHARS = 95_000;
