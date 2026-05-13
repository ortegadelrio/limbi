/**
 * Bucket `brand-documents` (Supabase Storage): MIME permitidos y mensajes de error legibles.
 * Debe alinearse con la migración que actualiza `storage.buckets.allowed_mime_types`.
 */

export const BRAND_DOCUMENTS_BUCKET_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
  "binary/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

/** Content-Type al subir texto generado por web-explore (debe estar en allowed_mime_types). */
export const BRAND_WEB_EXPLORE_STORAGE_CONTENT_TYPE = "text/plain";

export const BRAND_WEB_EXPLORE_STORAGE_SAVE_FAILED_ES =
  "Limbi pudo leer el sitio, pero no pudo guardar el texto extraído. Revisá la configuración del bucket de documentos.";

export function isBrandDocumentStorageMimeRejectedMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("mime") &&
    (m.includes("not supported") || m.includes("invalid") || m.includes("not allowed"))
  );
}

export function humanizeBrandDocumentStorageError(raw: string): string {
  if (isBrandDocumentStorageMimeRejectedMessage(raw)) {
    return BRAND_WEB_EXPLORE_STORAGE_SAVE_FAILED_ES;
  }
  return raw;
}
