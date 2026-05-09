import { EVIDENCE_TYPE_OPTIONS, NO_CLEAR_EVIDENCE } from "@/lib/constants/wizard";

/** Maps internal evidence type slugs to short Spanish labels for user-facing copy only. */
const EXTRA_SLUG_TO_LABEL_ES: Record<string, string> = {
  experience: "experiencia o trayectoria",
  metrics: "cifras o resultados",
  results: "cifras o resultados",
  clients: "clientes o aliados",
  clients_partners: "clientes o aliados",
  testimonials: "testimonios",
  case_studies: "casos de éxito",
  awards: "premios o reconocimientos",
  market_data: "datos de mercado",
  differentiators: "diferenciadores claros",
};

/**
 * Human Spanish label for an evidence type slug. Returns empty string when unknown
 * so callers can omit rather than surfacing raw enum values.
 */
export function evidenceTypeSlugToSpanishPublicLabel(slug: string): string {
  const s = String(slug).trim().toLowerCase();
  if (!s || s === String(NO_CLEAR_EVIDENCE)) return "";
  const fromWizard = EVIDENCE_TYPE_OPTIONS.find((o) => o.value === s);
  if (fromWizard) return fromWizard.label;
  return EXTRA_SLUG_TO_LABEL_ES[s] ?? "";
}

/** Joins mapped labels for a confirmation line; skips unknown slugs entirely. */
export function formatEvidenceTypeSlugsForUserFacingSummary(slugs: string[]): string {
  const labels = slugs
    .map((x) => evidenceTypeSlugToSpanishPublicLabel(x))
    .map((x) => x.trim())
    .filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  const last = labels.pop()!;
  return `${labels.join(", ")} y ${last}`;
}
