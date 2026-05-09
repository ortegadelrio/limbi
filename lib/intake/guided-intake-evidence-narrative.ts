import { NO_CLEAR_EVIDENCE } from "@/lib/constants/wizard";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { detectProofLikeEvidenceNarrative } from "@/lib/intake/guided-intake-evidence-input-classifier";

const WIZARD_EVIDENCE_TYPE_VALUES = new Set<string>([
  "results",
  "testimonials",
  "clients_partners",
  "awards",
  "case_studies",
  "differentiators",
  "market_data",
  NO_CLEAR_EVIDENCE,
]);

/**
 * Map free-text proof signals to wizard `evidence_types` only (never surfaced as raw slugs in UI).
 */
export function inferWizardEvidenceTypesFromProofNarrative(userText: string): string[] {
  const t = userText.trim();
  const out: string[] = [];
  if (/\b(testimonios?|referencias?\s+de\s+clientes)\b/i.test(t)) {
    out.push("testimonials");
  }
  if (/\b(premios?|reconocimientos?)\b/i.test(t)) {
    out.push("awards");
  }
  if (/\b(datos?\s+de\s+mercado|encuesta|estudios?\s+de\s+mercado)\b/i.test(t)) {
    out.push("market_data");
  }
  if (/\b(caso(s)?\s+de\s+[ée]xito)\b/i.test(t) || /\bcasos?\s+documentad(os|as)\b/i.test(t)) {
    out.push("case_studies");
  }
  if (
    /\b(viajes?\s+realizados|viajes?\s+para|implementaciones?|proyectos?\s+con)\b/i.test(
      t,
    ) &&
    /\d+/.test(t)
  ) {
    out.push("case_studies");
  }
  if (
    /\b(colegios?|clientes?|cuentas?|contratos?|aliad(os|as)?)\b/i.test(t) &&
    /\d+/.test(t)
  ) {
    out.push("clients_partners");
  }
  if (
    /\d+/.test(t) ||
    /\b(m[aá]s\s+de|m[aá]s)\s+\d+\s*a[nñ]os?\b/i.test(t) ||
    /\b\d+\s*a[nñ]os?\b/i.test(t) ||
    /\bexperiencia(\s+profesional)?\b/i.test(t) ||
    /\btrayectoria\b/i.test(t)
  ) {
    out.push("results");
  }
  const dedup = [...new Set(out.filter((x) => WIZARD_EVIDENCE_TYPE_VALUES.has(x)))];
  return dedup.length > 0 ? dedup : ["results"];
}

function readRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

/**
 * After LLM extraction on the evidence mini-step: ensure proof-like answers are stored,
 * `no_clear_evidence` is not kept alongside real proof, follow-up is cleared, and intent
 * stays on the answer path so segment confirmation can run.
 */
export function normalizeEvidenceStepExtractionOutput(
  userText: string,
  extraction: IntakeExtractionOutput,
): IntakeExtractionOutput {
  const clean = userText.trim();
  if (!detectProofLikeEvidenceNarrative(clean)) {
    return extraction;
  }

  const upd = readRecord(extraction.extracted_response_updates);
  const eb0 = readRecord(upd.evidence_base);
  const rawTypes = Array.isArray(eb0.evidence_types)
    ? (eb0.evidence_types as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const filteredTypes = rawTypes.filter(
    (x) => x !== NO_CLEAR_EVIDENCE && WIZARD_EVIDENCE_TYPE_VALUES.has(x),
  );
  const inferred = inferWizardEvidenceTypesFromProofNarrative(clean);
  const mergedTypes = [...new Set([...filteredTypes, ...inferred])].filter((x) =>
    WIZARD_EVIDENCE_TYPE_VALUES.has(x),
  );

  const details0 =
    eb0.evidence_details && typeof eb0.evidence_details === "object" && !Array.isArray(eb0.evidence_details)
      ? { ...(eb0.evidence_details as Record<string, unknown>) }
      : {};
  const hasSubstantiveDetail = Object.values(details0).some(
    (v) => typeof v === "string" && v.trim().length > 12,
  );
  if (!hasSubstantiveDetail) {
    details0.narrativa_usuario = clean.slice(0, 2000);
  }

  const nextEb: Record<string, unknown> = {
    ...eb0,
    evidence_types: mergedTypes,
    evidence_details: details0,
  };

  return {
    ...extraction,
    user_intent: "answer",
    needs_follow_up: false,
    follow_up_question: null,
    extracted_response_updates: {
      ...upd,
      evidence_base: nextEb,
    },
  };
}
