import { BRAINSTORMER_SUPPLEMENTAL_BRAND_CONTEXT_MAX_CHARS } from "@/lib/brainstormer/brainstormer-prompt-limits";
import { truncateForBrainstormerPrompt } from "@/lib/brainstormer/brainstormer-prompt-limits";

/** Subconjunto de bases para turnos que piden evidencia, credenciales o detalle de marca. */
export function pickSupplementalBrandPayload(
  knowledge: Record<string, unknown> | null,
  limbic: Record<string, unknown> | null,
): Record<string, unknown> {
  const k = knowledge ?? {};
  const l = limbic ?? {};
  const out: Record<string, unknown> = {};

  const cred = k.credibility_architecture;
  if (cred !== undefined) out.credibility_architecture = cred;

  const offer = k.offer_architecture;
  if (offer !== undefined) out.offer_architecture = offer;

  const sections = k.section_interpretations;
  if (Array.isArray(sections)) out.section_interpretations = sections;

  const restr = k.restrictions_and_alerts;
  if (typeof restr === "string" && restr.trim()) out.restrictions_and_alerts = restr;

  const evidence = k.evidence_base;
  if (evidence !== undefined) out.evidence_base = evidence;

  const sym = l.symbolic_reading;
  if (typeof sym === "string" && sym.trim()) out.limbic_symbolic_reading = sym;

  return out;
}

export function buildSupplementalBrandContextBlock(
  knowledge: Record<string, unknown> | null,
  limbic: Record<string, unknown> | null,
  maxChars: number = BRAINSTORMER_SUPPLEMENTAL_BRAND_CONTEXT_MAX_CHARS,
): string {
  const subset = pickSupplementalBrandPayload(knowledge, limbic);
  const truncated = truncateForBrainstormerPrompt(subset, maxChars);
  if (Object.keys(subset).length === 0) return "";

  return `BRAND_CONTEXT_SUPPLEMENT (reduced — evidence/credentials/detail only; do not treat as full base):
${truncated.text}`;
}
