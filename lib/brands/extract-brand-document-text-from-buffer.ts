import "server-only";

import { extractPdfTextFromBuffer } from "@/lib/brands/extract-pdf-text";
import {
  BRAND_CONTEXT_DOCX_UNREADABLE_ES,
  inferBrandContextFileKind,
  type BrandContextFileKind,
} from "@/lib/brands/validate-brand-context-upload";
import { BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS } from "@/lib/brands/validate-pdf-upload";

export type BrandDocumentBufferExtraction = {
  text: string;
  pageCount: number | null;
  characterCount: number;
  truncated: boolean;
  metadata: Record<string, unknown>;
};

function truncateToLimit(
  raw: string,
  engine: string,
): Pick<BrandDocumentBufferExtraction, "text" | "truncated" | "characterCount" | "metadata"> {
  const originalLen = raw.length;
  let text = raw;
  let truncated = false;
  if (originalLen > BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS) {
    text = raw.slice(0, BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS);
    truncated = true;
  }
  const metadata: Record<string, unknown> = {
    engine,
    truncated,
    ...(truncated
      ? {
          truncated_at_chars: BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS,
          original_character_count: originalLen,
        }
      : {}),
  };
  return {
    text,
    truncated,
    characterCount: text.length,
    metadata,
  };
}

export async function extractBrandDocumentTextFromBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<BrandDocumentBufferExtraction> {
  const kind: BrandContextFileKind | null = inferBrandContextFileKind(fileName);
  if (kind === "pdf") {
    return extractPdfTextFromBuffer(buffer);
  }

  if (kind === "docx") {
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      const raw = (value ?? "").replace(/\0/g, "");
      const t = truncateToLimit(raw, "mammoth-docx");
      return {
        ...t,
        pageCount: null,
        metadata: { ...t.metadata, source_format: "docx" },
      };
    } catch {
      throw new Error(BRAND_CONTEXT_DOCX_UNREADABLE_ES);
    }
  }

  if (kind === "txt") {
    const raw = buffer.toString("utf8").replace(/\0/g, "");
    const t = truncateToLimit(raw, "utf-8-text");
    return {
      ...t,
      pageCount: null,
      metadata: { ...t.metadata, source_format: "txt" },
    };
  }

  throw new Error(`Formato de archivo no soportado para extracción: ${fileName}`);
}
