/**
 * Guided Intake V1 — capture first, diagnose later.
 * On `main` / `follow_up`, Limbi may orient and clarify but must not deliver final
 * strategic recommendations or treat open lists as definitive priority.
 */

/** Default when the user asks Limbi to choose but has not yet named several actors. */
export const CAPTURE_PHASE_ORIENTATION_DEFAULT_ES =
  "Puedo orientarte, pero la recomendación fuerte la haré mejor cuando tenga toda la captura. Por ahora dime qué actores intervienen: quién compra, quién usa, quién autoriza, quién recomienda o quién puede bloquear la decisión. Luego en el diagnóstico te diré cuál conviene priorizar.";

const ACTOR_LEXEMES: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bcolegios?\b/i, label: "colegios" },
  { pattern: /\bescuelas?\b/i, label: "escuelas" },
  { pattern: /\bpadres?\b/i, label: "padres" },
  { pattern: /\bmadres?\b/i, label: "madres" },
  { pattern: /\bestudiantes?\b/i, label: "estudiantes" },
  { pattern: /\balumnos?\b/i, label: "alumnos" },
  { pattern: /\bdocentes?\b/i, label: "docentes" },
  { pattern: /\bprofesores?\b/i, label: "profesores" },
  { pattern: /\bfamilias?\b/i, label: "familias" },
  { pattern: /\bdirectivos?\b/i, label: "directivos" },
  { pattern: /\bniños\b/i, label: "niños" },
  { pattern: /\bniñas\b/i, label: "niñas" },
  { pattern: /\badolescentes?\b/i, label: "adolescentes" },
  { pattern: /\bclientes?\b/i, label: "clientes" },
  { pattern: /\bcompradores?\b/i, label: "compradores" },
  { pattern: /\busuarios?\b/i, label: "usuarios" },
];

/**
 * Pulls simple actor nouns from the user line (Spanish, generic; no wizard slugs).
 * Order follows first occurrence in `userText`.
 */
export function extractIdentifiedActorLabelsFromUserText(userText: string): string[] {
  const hits: { label: string; index: number }[] = [];
  const seen = new Set<string>();
  for (const { pattern, label } of ACTOR_LEXEMES) {
    const re = new RegExp(pattern.source, "i");
    const m = userText.match(re);
    if (m && m.index !== undefined && !seen.has(label)) {
      seen.add(label);
      hits.push({ label, index: m.index });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((h) => h.label);
}

function joinSpanishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]!}`;
}

export type BuildCapturePhaseOrientationParams = {
  /** Last user line (Spanish). */
  userText: string;
};

/**
 * Short guided reply: orientation only, no final “priorizar X” recommendation during capture.
 */
export function buildCapturePhaseStrategicDeferralInterviewerMessage(
  params?: BuildCapturePhaseOrientationParams,
): string {
  const t = (params?.userText ?? "").trim();
  const actors = extractIdentifiedActorLabelsFromUserText(t);
  if (actors.length >= 2) {
    return `Hasta ahora aparecen ${joinSpanishList(actors)}. Los dejo como actores identificados; la prioridad la definiremos en el diagnóstico.`.trim();
  }

  return CAPTURE_PHASE_ORIENTATION_DEFAULT_ES.trim();
}
