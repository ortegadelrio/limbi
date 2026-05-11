/** Límite alineado con `file_size_limit` del bucket en migración (25 MiB). */
export const BRAND_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

const PDF_INVALID_MESSAGE =
  "El archivo debe ser un PDF válido. Si lo exportaste desde otra plataforma, intenta descargarlo de nuevo como PDF y volver a subirlo.";

/** Códigos para API / diagnóstico (no confundir con fallos de Storage). */
export const PDF_VALIDATION_CODES = {
  INVALID_EXTENSION: "validation_invalid_extension",
  INVALID_MIME: "validation_invalid_mime",
  FILE_TOO_LARGE: "validation_file_too_large",
  EMPTY_FILE: "validation_empty_file",
  MAGIC_BYTES_MISMATCH: "validation_magic_bytes_mismatch",
} as const;

export type PdfValidationErrorCode =
  (typeof PDF_VALIDATION_CODES)[keyof typeof PDF_VALIDATION_CODES];

export type PdfValidationResult =
  | { ok: true; magicBytesMatch: boolean }
  | {
      ok: false;
      code: PdfValidationErrorCode;
      message: string;
      /** Detalle técnico breve (p. ej. MIME recibido). */
      detail?: string;
    };

function hasPdfExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

/** Normaliza `File.type` (p. ej. quita parámetros tras `;`). */
export function normalizeClientMimeType(raw: string): string {
  const t = raw.trim().toLowerCase();
  const semi = t.indexOf(";");
  return semi === -1 ? t : t.slice(0, semi).trim();
}

/** MIME que aceptamos junto a extensión `.pdf` (navegadores / SO). */
export function mimeLooksPdfForPdfExtension(mime: string): boolean {
  const m = normalizeClientMimeType(mime);
  if (m === "") return true;
  if (m === "application/pdf") return true;
  if (m === "application/x-pdf") return true;
  if (m === "application/octet-stream") return true;
  if (m === "binary/octet-stream") return true;
  return false;
}

/** Busca la firma `%PDF-` en los primeros bytes (algunos archivos tienen prefijo antes del header). */
function hasPdfMagicInBuffer(buf: Uint8Array): boolean {
  const max = Math.max(0, buf.length - 5);
  for (let i = 0; i <= max; i++) {
    if (
      buf[i] === 0x25 &&
      buf[i + 1] === 0x50 &&
      buf[i + 2] === 0x44 &&
      buf[i + 3] === 0x46 &&
      buf[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

export type PdfMetadataInput = {
  file_name: string;
  file_size_bytes: number;
  /** MIME del cliente; cadena vacía = omitir chequeo MIME estricto. */
  file_type: string;
};

/** Validación solo metadata (servidor prepare-upload y chequeo rápido en cliente). */
export function validatePdfUploadMetadata(
  input: PdfMetadataInput,
): PdfValidationResult {
  if (!hasPdfExtension(input.file_name)) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.INVALID_EXTENSION,
      message: "Solo se aceptan archivos PDF (.pdf).",
    };
  }

  const mimeRaw = input.file_type;

  if (mimeRaw.trim() !== "" && !mimeLooksPdfForPdfExtension(mimeRaw)) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.INVALID_MIME,
      message:
        "El tipo de archivo (MIME) no es uno de los permitidos para subir un PDF.",
      detail: `MIME recibido: ${mimeRaw}`,
    };
  }

  if (input.file_size_bytes > BRAND_DOCUMENT_MAX_BYTES) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.FILE_TOO_LARGE,
      message: `El archivo supera el máximo de ${BRAND_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB.`,
      detail: `Tamaño: ${(input.file_size_bytes / (1024 * 1024)).toFixed(2)} MB.`,
    };
  }
  if (input.file_size_bytes === 0) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.EMPTY_FILE,
      message: "El archivo está vacío.",
    };
  }

  return { ok: true, magicBytesMatch: true };
}

/** Cabecera %PDF- en los primeros 4 KB (opcional en cliente antes de prepare). */
export async function validatePdfMagicBytesClient(file: File): Promise<PdfValidationResult> {
  const meta = validatePdfUploadMetadata({
    file_name: file.name,
    file_size_bytes: file.size,
    file_type: file.type,
  });
  if (!meta.ok) return meta;

  const scan = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const magicBytesMatch = hasPdfMagicInBuffer(scan);
  if (!magicBytesMatch) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.MAGIC_BYTES_MISMATCH,
      message: PDF_INVALID_MESSAGE,
      detail:
        "No se encontró la firma %PDF- en los primeros 4 KB del archivo (¿archivo dañado o no PDF?).",
    };
  }
  return { ok: true, magicBytesMatch: true };
}

export async function validatePdfUpload(file: File): Promise<PdfValidationResult> {
  if (!hasPdfExtension(file.name)) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.INVALID_EXTENSION,
      message: "Solo se aceptan archivos PDF (.pdf).",
    };
  }

  const metaOnly = validatePdfUploadMetadata({
    file_name: file.name,
    file_size_bytes: file.size,
    file_type: file.type,
  });
  if (!metaOnly.ok) return metaOnly;

  const scan = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const magicBytesMatch = hasPdfMagicInBuffer(scan);
  if (!magicBytesMatch) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.MAGIC_BYTES_MISMATCH,
      message: PDF_INVALID_MESSAGE,
      detail:
        "No se encontró la firma %PDF- en los primeros 4 KB del archivo (¿archivo dañado o no PDF?).",
    };
  }

  return { ok: true, magicBytesMatch: true };
}
