import type { BrandDocumentAnalysisFindingParsed } from "@/lib/schemas/brand-document-analysis";
import { normalizeForBrandSourceFactFingerprint } from "@/lib/brands/brand-source-facts-dedupe";

export type StructuredOfferItemForDedupe = {
  title: string;
  description: string | null;
};

export type StructuredTerritoryForDedupe = {
  name: string;
};

function normalizedChunksFromOfferItems(
  items: StructuredOfferItemForDedupe[],
): string[] {
  const out: string[] = [];
  for (const it of items) {
    const t = (it.title ?? "").trim();
    const d = (it.description ?? "").trim();
    if (!t && !d) continue;
    const combined = [t, d].filter(Boolean).join(" ").trim();
    if (combined.length > 0) {
      out.push(normalizeForBrandSourceFactFingerprint(combined));
    }
    if (t.length > 0) {
      out.push(normalizeForBrandSourceFactFingerprint(t));
    }
  }
  return out;
}

function normalizedChunksFromTerritories(rows: StructuredTerritoryForDedupe[]): string[] {
  return rows
    .map((r) => (r.name ?? "").trim())
    .filter((n) => n.length > 0)
    .map((n) => normalizeForBrandSourceFactFingerprint(n));
}

/**
 * Evita hallazgos que solo repiten oferta o territorios ya capturados en tablas estructuradas.
 * No aplica a `contradicts` (puede haber tensión frente a lo guardado).
 */
export function findingDuplicatesStructuredBrandContext(
  f: BrandDocumentAnalysisFindingParsed,
  args: {
    offerItems: StructuredOfferItemForDedupe[];
    territories: StructuredTerritoryForDedupe[];
  },
): boolean {
  if (f.relationship_type === "contradicts") return false;

  const prop = normalizeForBrandSourceFactFingerprint(f.proposed_inclusion);
  const ext = normalizeForBrandSourceFactFingerprint(f.extracted_fact);
  const blobs = [
    ...normalizedChunksFromOfferItems(args.offerItems),
    ...normalizedChunksFromTerritories(args.territories),
  ].filter((b) => b.length >= 12);

  for (const b of blobs) {
    for (const candidate of [prop, ext]) {
      if (candidate.length < 12) continue;
      if (candidate === b) return true;
      if (candidate.length >= 28 && b.length >= 28) {
        if (candidate.includes(b) || b.includes(candidate)) return true;
      }
    }
  }
  return false;
}
