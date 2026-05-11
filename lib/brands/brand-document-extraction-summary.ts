import type {
  BrandDocumentExtractionStatus,
  BrandDocumentListRow,
  BrandDocumentRow,
} from "@/types/database";

export type BrandDocumentExtractionListFields = {
  brand_document_id: string;
  extraction_status: BrandDocumentExtractionStatus;
  page_count: number | null;
  character_count: number | null;
  extraction_metadata: Record<string, unknown> | null;
  error_message: string | null;
};

export function attachExtractionSummaries(
  docs: BrandDocumentRow[],
  extractions: BrandDocumentExtractionListFields[] | null | undefined,
): BrandDocumentListRow[] {
  const map = new Map(
    (extractions ?? []).map((e) => [e.brand_document_id, e]),
  );
  return docs.map((d) => {
    const ex = map.get(d.id);
    if (!ex) {
      return { ...d, extraction_summary: null };
    }
    const meta = (ex.extraction_metadata ?? {}) as Record<string, unknown>;
    const truncated = Boolean(meta.truncated);
    const summaryMessage =
      ex.extraction_status === "succeeded_empty" || ex.extraction_status === "failed"
        ? ex.error_message
        : null;
    return {
      ...d,
      extraction_summary: {
        extraction_status: ex.extraction_status,
        page_count: ex.page_count,
        character_count: ex.character_count,
        truncated,
        summary_message: summaryMessage,
      },
    };
  });
}
