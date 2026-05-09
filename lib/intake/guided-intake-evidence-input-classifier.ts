/**
 * Deterministic classifiers for the evidence mini-step when the user drifts to
 * audience stakeholders or value positioning instead of proof-like evidence.
 */

const EVIDENCE_SUBSTANCE_LEX =
  /\b(\d+\s*a[nñ]os?\s*(de\s+)?experiencia|testimonio|testimonios|caso(s)?\s+de\s+[eé]xito|cifras?|m[eé]tricas?|datos?\s+de\s+mercado|benchmark|premio|reconocimiento|clientes?\s+que|proyectos?\s+completados)\b/i;

/**
 * User is naming actors / stakeholders while on the evidence step — route to
 * audience context, not evidence persistence. Kept generic (no vertical exemplars).
 */
export function detectEvidenceStepAudienceStakeholderInput(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 22) return false;
  if (EVIDENCE_SUBSTANCE_LEX.test(t)) return false;

  const actorMeta =
    /\b(actor(es)?\s*(clave|importante|relevante)|stakeholder|p[uú]blico\s+objetivo)\b/i.test(
      t,
    ) ||
    /\b(tambi[eé]n\s+es\s+un\s+actor)\b/i.test(t) ||
    /\b(validador|validadora|habilitador|habilitadora)\b/i.test(t);

  return actorMeta;
}

/**
 * Short value-positioning claim without concrete proof — not persisted as evidence.
 */
export function detectEvidenceStepPositioningClaim(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 8 || t.length > 260) return false;
  if (EVIDENCE_SUBSTANCE_LEX.test(t)) return false;
  if (detectEvidenceStepAudienceStakeholderInput(t)) return false;

  const claimish =
    /\b(servicio\s+premium|marca\s+premium|propuesta\s+de\s+valor|posicionamiento|calidad\s+premium|de\s+alto\s+nivel|exclusiv[oa]s?|l[ií]der(es)?\s+del\s+mercado)\b/i.test(
      t,
    ) || /\b(es|somos|es\s+un)\s+.{0,48}\b(premium|exclusiv|lujo)\b/i.test(t);

  return claimish;
}
