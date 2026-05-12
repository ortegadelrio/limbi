import {
  BRAND_DOCUMENT_MAX_BYTES,
  normalizeClientMimeType,
  PDF_VALIDATION_CODES,
  type PdfValidationResult,
} from "@/lib/brands/validate-pdf-upload";

/** Extensión no soportada o MIME incompatible con el material de contexto de marca. */
export const BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES =
  "Formato no soportado. Puedes subir PDF, Word (.docx) o texto plano (.txt).";

export const BRAND_CONTEXT_DOCX_UNREADABLE_ES =
  "No pudimos leer este Word. Verifica que sea un archivo .docx válido y no esté protegido o dañado.";

export const BRAND_CONTEXT_TXT_NO_USEFUL_TEXT_ES =
  "No encontramos texto útil en este archivo .txt.";

export const BRAND_CONTEXT_EXTRACTION_GENERIC_FAILURE_ES =
  "No pudimos extraer texto útil. Puede estar protegido, dañado o no tener texto seleccionable.";

export type BrandContextFileKind = "pdf" | "docx" | "txt";

export type BrandContextUploadMetadataInput = {
  file_name: string;
  file_size_bytes: number;
  file_type: string;
};

export function inferBrandContextFileKind(fileName: string): BrandContextFileKind | null {
  const n = fileName.trim().toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".txt")) return "txt";
  return null;
}

export function storageExtensionForKind(kind: BrandContextFileKind): string {
  switch (kind) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "txt":
      return "txt";
    default:
      return "bin";
  }
}

export function defaultMimeForBrandContextKind(kind: BrandContextFileKind): string {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

/**
 * MIME que no debe aceptarse aunque la extensión sea .docx / .txt (evita HTML/imágenes disfrazadas).
 * `application/octet-stream` y similares se permiten solo cuando la extensión ya es la correcta.
 */
function mimeIsDangerousDisguiseForDocxOrTxt(mimeRaw: string): boolean {
  const m = normalizeClientMimeType(mimeRaw);
  if (m === "") return false;
  if (m === "application/octet-stream" || m === "binary/octet-stream") return false;
  if (m.startsWith("text/html")) return true;
  if (m.startsWith("image/")) return true;
  if (m.startsWith("video/")) return true;
  if (m.startsWith("audio/")) return true;
  if (m === "application/javascript" || m === "text/javascript") return true;
  if (m === "application/x-msdownload" || m === "application/x-msdos-program") return true;
  return false;
}

/** Validación metadata para PDF, DOCX o TXT (material de contexto de marca). */
export function validateBrandContextUploadMetadata(
  input: BrandContextUploadMetadataInput,
): PdfValidationResult {
  const kind = inferBrandContextFileKind(input.file_name);
  if (!kind) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.INVALID_EXTENSION,
      message: BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES,
    };
  }

  const mimeRaw = input.file_type;
  if (mimeRaw.trim() !== "") {
    if (kind === "pdf") {
      const m = normalizeClientMimeType(mimeRaw);
      const pdfOk =
        m === "application/pdf" ||
        m === "application/x-pdf" ||
        m === "application/octet-stream" ||
        m === "binary/octet-stream";
      if (!pdfOk) {
        return {
          ok: false,
          code: PDF_VALIDATION_CODES.INVALID_MIME,
          message: BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES,
          detail: `MIME recibido: ${mimeRaw}`,
        };
      }
    } else if (kind === "docx" || kind === "txt") {
      if (mimeIsDangerousDisguiseForDocxOrTxt(mimeRaw)) {
        return {
          ok: false,
          code: PDF_VALIDATION_CODES.INVALID_MIME,
          message: BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES,
          detail: `MIME recibido: ${mimeRaw}`,
        };
      }
    }
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

function hasZipLocalHeader(buf: Uint8Array): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  );
}

/** Cabeceras mínimas en los primeros 8 KB antes de subir a Storage. */
export async function validateBrandContextMagicBytesClient(
  file: File,
): Promise<PdfValidationResult> {
  const kind = inferBrandContextFileKind(file.name);
  if (!kind) {
    return {
      ok: false,
      code: PDF_VALIDATION_CODES.INVALID_EXTENSION,
      message: BRAND_CONTEXT_UNSUPPORTED_FORMAT_ES,
    };
  }

  const meta = validateBrandContextUploadMetadata({
    file_name: file.name,
    file_size_bytes: file.size,
    file_type: file.type,
  });
  if (!meta.ok) return meta;

  const scan = new Uint8Array(await file.slice(0, 8192).arrayBuffer());

  if (kind === "pdf") {
    const magicBytesMatch = hasPdfMagicInBuffer(scan);
    if (!magicBytesMatch) {
      return {
        ok: false,
        code: PDF_VALIDATION_CODES.MAGIC_BYTES_MISMATCH,
        message:
          "El archivo no parece un PDF válido. Si lo exportaste desde otra plataforma, descargalo de nuevo como PDF.",
        detail:
          "No se encontró la firma %PDF- en los primeros 8 KB del archivo (¿archivo dañado o no PDF?).",
      };
    }
    return { ok: true, magicBytesMatch: true };
  }

  if (kind === "docx") {
    const magicBytesMatch = hasZipLocalHeader(scan);
    if (!magicBytesMatch) {
      return {
        ok: false,
        code: PDF_VALIDATION_CODES.MAGIC_BYTES_MISMATCH,
        message: BRAND_CONTEXT_DOCX_UNREADABLE_ES,
        detail: "No se encontró cabecera ZIP (PK) al inicio del archivo.",
      };
    }
    return { ok: true, magicBytesMatch: true };
  }

  // TXT: sin firma obligatoria; aceptar bytes raros (UTF-8 no estricto en la muestra).
  new TextDecoder("utf-8", { fatal: false }).decode(scan);

  return { ok: true, magicBytesMatch: true };
}

export { BRAND_DOCUMENT_MAX_BYTES };
