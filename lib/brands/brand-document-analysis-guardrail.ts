import type { BrandDocumentAnalysisFindingParsed } from "@/lib/schemas/brand-document-analysis";

const EXCLUSIVE_RE =
  /\b(solo|únicamente|unicamente|exclusivamente|nunca|solamente)\b/i;

const META_INCLUSION_START_RE =
  /^\s*(el\s+documento\s+(menciona|sugiere|indica|establece|señala|describe)|esto\s+implica|según\s+el\s+documento)\b/i;

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function hasExclusiveLanguage(text: string): boolean {
  return EXCLUSIVE_RE.test(text);
}

function extractPeopleCountHint(text: string): number | null {
  const t = text.toLowerCase();
  if (!/(colaborador|profesional|emplead|integrante)/.test(t)) return null;
  const m1 = t.match(
    /\b(?:más\s+de|alrededor\s+de|aprox\.?|unos?|unas?|casi)\s+(\d{2,4})\b/i,
  );
  if (m1) return parseInt(m1[1], 10);
  const m2 = t.match(/\b(\d{2,4})\s*(?:colaboradores|profesionales|empleados)\b/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function hasConflictingHeadcounts(existing: string, extracted: string): boolean {
  const a = extractPeopleCountHint(existing);
  const b = extractPeopleCountHint(extracted);
  if (a == null || b == null) return false;
  return a !== b && Math.abs(a - b) >= 2;
}

function proposedSuggestsResolvedTension(proposed: string): boolean {
  const p = norm(proposed);
  if (!p) return false;
  if (/\d+\s*[^\d.]{0,50}\d+/.test(p) && /vigente|alinear|definir|cuál\s+cifra|cuál\s+dato/i.test(p)) {
    return true;
  }
  return /no\s+pueden\s+convivir|dos\s+cifras\s+en\s+juego|contradicción|discrepancia/i.test(p);
}

/**
 * Señales mínimas de que un `contradicts` es defendible (tensión factual o de alcance excluyente).
 */
export function hasExplicitContradictionSignals(f: BrandDocumentAnalysisFindingParsed): boolean {
  const existing = norm(f.existing_response_summary);
  const extracted = norm(f.extracted_fact);
  const proposed = norm(f.proposed_inclusion);
  const combined = `${existing}\n${extracted}\n${proposed}`;

  if (hasExclusiveLanguage(combined)) return true;
  if (existing && extracted && hasConflictingHeadcounts(existing, extracted)) return true;
  if (proposedSuggestsResolvedTension(proposed)) return true;

  if (
    /incompatible|mutuamente\s+excluyente|excluye\s+a|no\s+puede\s+ser\s+ambos|no\s+coinciden/i.test(
      combined,
    )
  ) {
    return true;
  }

  return false;
}

function isMarketingAudienceBroadeningCase(f: BrandDocumentAnalysisFindingParsed): boolean {
  const existing = norm(f.existing_response_summary).toLowerCase();
  const extracted = norm(f.extracted_fact).toLowerCase();
  if (!existing) return false;
  if (
    !/marketing|comunicaci[oó]n/.test(existing) ||
    !/(marca|empresa)/.test(existing)
  ) {
    return false;
  }
  if (
    /trabaj\w+\s+con\s+marcas|marcas\s+en\s+diversos\s+contextos|diversos\s+contextos|distintos\s+contextos/i.test(
      extracted,
    )
  ) {
    return true;
  }
  return false;
}

function defaultIntegratedAudienceProposedInclusion(brandName: string): string {
  const name = brandName.trim() || "La marca";
  return `${name} trabaja con equipos de marketing y comunicaciones de marcas y empresas, acompañando retos de comunicación en distintos contextos estratégicos.`;
}

function shouldDiscardNonContradictsForMetaInclusion(
  f: BrandDocumentAnalysisFindingParsed,
): boolean {
  if (f.relationship_type === "contradicts") return false;
  const p = norm(f.proposed_inclusion);
  if (!p) return true;
  return META_INCLUSION_START_RE.test(p);
}

/**
 * Post-procesado defensivo: corrige falsos `contradicts`, descarta inclusiones meta de baja calidad.
 */
export function applyBrandDocumentAnalysisGuardrails(
  findings: BrandDocumentAnalysisFindingParsed[],
  brandDisplayName: string,
): BrandDocumentAnalysisFindingParsed[] {
  const out: BrandDocumentAnalysisFindingParsed[] = [];

  for (const raw of findings) {
    if (shouldDiscardNonContradictsForMetaInclusion(raw)) {
      continue;
    }

    let f: BrandDocumentAnalysisFindingParsed = { ...raw };

    if (f.relationship_type === "contradicts" && !hasExplicitContradictionSignals(f)) {
      f = { ...f, relationship_type: "complements" };
      if (isMarketingAudienceBroadeningCase(raw)) {
        f = {
          ...f,
          proposed_inclusion: defaultIntegratedAudienceProposedInclusion(brandDisplayName),
        };
      }
    }

    out.push(f);
  }

  return out;
}
