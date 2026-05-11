import type { BrandDocumentAnalysisFindingParsed } from "@/lib/schemas/brand-document-analysis";
import type { BrandResponseRow, QuestionDefinitionRow } from "@/types/database";
import {
  buildBrandSourceFactFingerprint,
  normalizeForBrandSourceFactFingerprint,
} from "@/lib/brands/brand-source-facts-dedupe";
import {
  BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION,
  BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL,
} from "@/lib/brands/brand-document-analysis-limits";

type DefinitionIndex = {
  sectionKeys: Set<string>;
  questionByKey: Map<
    string,
    { section_key: string; module_key: string; question_text: string }
  >;
};

export function buildDefinitionIndex(defs: QuestionDefinitionRow[]): DefinitionIndex {
  const sectionKeys = new Set<string>();
  const questionByKey = new Map<
    string,
    { section_key: string; module_key: string; question_text: string }
  >();
  for (const d of defs) {
    sectionKeys.add(d.section_key);
    questionByKey.set(d.question_key, {
      section_key: d.section_key,
      module_key: d.module_key,
      question_text: d.question_text,
    });
  }
  return { sectionKeys, questionByKey };
}

function normalizeAnswer(r: BrandResponseRow): string {
  const t = (r.answer_text ?? "").trim();
  if (t.length > 0) return normalizeForBrandSourceFactFingerprint(t);
  return normalizeForBrandSourceFactFingerprint(JSON.stringify(r.answer_value ?? {}));
}

/**
 * Filtra hallazgos de la IA: claves permitidas, límites por sección y total,
 * dedupe por fingerprint frente al batch y a fingerprints ya conocidos (approved, etc.).
 */
export function filterAndCapFindings(args: {
  findings: BrandDocumentAnalysisFindingParsed[];
  index: DefinitionIndex;
  existingFingerprints: Set<string>;
  perSectionCounts: Map<string, number>;
  totalSoFar: number;
}): BrandDocumentAnalysisFindingParsed[] {
  const { findings, index, existingFingerprints, perSectionCounts, totalSoFar } = args;
  const out: BrandDocumentAnalysisFindingParsed[] = [];
  let total = totalSoFar;

  for (const raw of findings) {
    if (total >= BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_TOTAL) break;
    if (!index.sectionKeys.has(raw.section_key)) continue;

    const question_key = raw.question_key;
    let module_key = raw.module_key;

    if (question_key) {
      const def = index.questionByKey.get(question_key);
      if (!def) continue;
      if (def.section_key !== raw.section_key) continue;
      module_key = def.module_key;
    } else if (module_key) {
      const ok = [...index.questionByKey.values()].some(
        (q) => q.section_key === raw.section_key && q.module_key === module_key,
      );
      if (!ok) continue;
    }

    const sectionCount = perSectionCounts.get(raw.section_key) ?? 0;
    if (sectionCount >= BRAND_DOCUMENT_ANALYSIS_MAX_FINDINGS_PER_SECTION) continue;

    const fp = buildBrandSourceFactFingerprint({
      proposed_inclusion: raw.proposed_inclusion,
      extracted_fact: raw.extracted_fact,
      section_key: raw.section_key,
      question_key: question_key,
    });
    if (existingFingerprints.has(fp)) continue;

    const normalized: BrandDocumentAnalysisFindingParsed = {
      ...raw,
      module_key,
      question_key,
    };

    out.push(normalized);
    existingFingerprints.add(fp);
    perSectionCounts.set(raw.section_key, sectionCount + 1);
    total += 1;
  }

  return out;
}

/** Si el hallazgo no contradice y repite esencialmente la respuesta del usuario, descartar. */
export function findingDuplicatesBrandResponse(
  f: BrandDocumentAnalysisFindingParsed,
  responses: BrandResponseRow[],
): boolean {
  if (f.relationship_type === "contradicts") return false;
  if (!f.question_key) return false;
  const row = responses.find((r) => r.question_key === f.question_key);
  if (!row) return false;
  const ans = normalizeAnswer(row);
  const prop = normalizeForBrandSourceFactFingerprint(f.proposed_inclusion);
  if (ans.length < 8 || prop.length < 8) return false;
  if (ans === prop) return true;
  if (f.relationship_type === "reinforces") return false;
  if (ans.includes(prop) && prop.length >= 20) return true;
  return false;
}
