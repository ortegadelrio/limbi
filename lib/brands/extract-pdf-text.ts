import "server-only";

import { BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS } from "@/lib/brands/validate-pdf-upload";

export type ExtractPdfTextResult = {
  text: string;
  pageCount: number | null;
  characterCount: number;
  truncated: boolean;
  metadata: Record<string, unknown>;
};

/**
 * Extrae texto plano de un PDF en memoria (solo servidor).
 * Usa `pdf-parse` v2 (`PDFParse` + `getText()`).
 */
export async function extractPdfTextFromBuffer(
  buffer: Buffer,
): Promise<ExtractPdfTextResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    const raw = (textResult.text ?? "").replace(/\0/g, "");
    const pageCount =
      Array.isArray(textResult.pages) && textResult.pages.length > 0
        ? textResult.pages.length
        : typeof textResult.total === "number"
          ? textResult.total
          : null;

    const originalLen = raw.length;
    let text = raw;
    let truncated = false;
    if (originalLen > BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS) {
      text = raw.slice(0, BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS);
      truncated = true;
    }

    const metadata: Record<string, unknown> = {
      engine: "pdf-parse",
      truncated,
      ...(truncated
        ? { truncated_at_chars: BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS }
        : {}),
      ...(truncated ? { original_character_count: originalLen } : {}),
    };

    return {
      text,
      pageCount,
      characterCount: text.length,
      truncated,
      metadata,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
