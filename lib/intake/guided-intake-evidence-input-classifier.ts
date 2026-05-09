/**
 * Deterministic classifiers for the evidence mini-step when the user drifts to
 * audience stakeholders or value positioning instead of proof-like evidence.
 */

/** Signals that the user is offering concrete proof (not meta-commentary). */
const EVIDENCE_SUBSTANCE_LEX =
  /\b(\d+\s*a[nñ]os?\s*(de\s+)?experiencia|experiencia(\s+de\s+|\s+)(m[aá]s\s+de\s+)?\d+\s*a[nñ]os?|m[aá]s\s+de\s+\d+\s*a[nñ]os?|\d+\s+viajes?|viajes?\s+realizados|testimonio|testimonios|caso(s)?\s+de\s+[eé]xito|cifras?|m[eé]tricas?|datos?\s+de\s+mercado|benchmark|premio|reconocimiento|clientes?\s+que|proyectos?\s+completados|trayectoria(\s+de\s+|\s+)\d+|\d+\s+clientes?|\d+\s+casos?)\b/i;

/**
 * User supplied substantive proof in free text (including “no tengo más que …” with content).
 */
export function detectProofLikeEvidenceNarrative(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 12) return false;
  if (/\bno\s+tengo\s+m[aá]s\s+que\b/i.test(t)) return true;
  if (/\bno\s+tengo\s+nada\s+m[aá]s\s+que\b/i.test(t)) return true;
  if (/\bsolo\s+tengo\b/i.test(t) && t.length > 24) return true;
  if (EVIDENCE_SUBSTANCE_LEX.test(t)) return true;
  if (/\b\d+\s+(viajes?|clientes?|casos?|proyectos?|colegios?)\b/i.test(t)) return true;
  if (/\b(m[aá]s\s+de|unos?\s+|casi\s+)\d+\s*a[nñ]os?\b/i.test(t)) return true;
  if (/\b(trayectoria|track\s*record)\b/i.test(t)) return true;
  return false;
}

/**
 * True when the user declares they lack evidence (narrow patterns — not “no tengo más que X”).
 */
export function explicitEvidenceAbsenceDeclaration(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 8) return false;
  if (detectProofLikeEvidenceNarrative(t)) return false;
  const s = t.toLowerCase();
  return (
    /\b(sin\s+evidencia|no\s+hay\s+evidencia|nada\s+de\s+evidencia)\b/i.test(s) ||
    /\bno\s+tengo\s+(ninguna\s+)?(evidencia|prueba|pruebas|dato\s+concreto|datos\s+concretos)\b/i.test(
      s,
    ) ||
    /\b(no\s+disponemos|no\s+contamos)\s+con\s+(evidencia|pruebas|datos)\b/i.test(s) ||
    /\ba[uú]n\s+no\s+tengo\s+(nada|evidencia|pruebas|datos)\b/i.test(s) ||
    /\b(todav[ií]a|a[uú]n)\s+no\s+tengo\s+(nada|evidencia|pruebas)\b/i.test(s)
  );
}

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
