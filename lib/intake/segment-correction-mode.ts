import { classifySegmentConfirmationUserReply } from "@/lib/intake/segment-confirmation";
import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";

/** How to treat free text after “Quiero ajustar” (segment correction). */
export type SegmentCorrectionMode = "add" | "replace" | "improve";

const ADDITIVE_RES = [
  /\bagregar(ía|ia|í)\b/i,
  /\btambién\b/i,
  /\bademás\b/i,
  /\bsumar(ía|ia|í)\b/i,
  /\bincluir(ía|ia|í)\b/i,
  /\bquiero agregar\b/i,
  /\bme falt[oó] decir\b/i,
  /\btambi[eé]n deber[ií]a decir\b/i,
  /\bno solo\b[^.]{0,120}\btambi[eé]n\b/i,
] as const;

const REPLACE_RES = [
  /\bmejor dicho\b/i,
  /\ben realidad\b/i,
  /\bc[aá]mbialo por\b/i,
  /\breempl[aá]zalo\b/i,
  /\bquita lo anterior\b/i,
  /\bno es eso\b/i,
  /\beso est[aá] mal\b/i,
  /\bborra eso\b/i,
  /\belimina lo anterior\b/i,
] as const;

const IMPROVE_RES = [
  /\bred[aá]ctalo mejor\b/i,
  /\bhazlo m[aá]s claro\b/i,
  /\bmej[oó]ralo\b/i,
  /\bmejoralo\b/i,
  /\bsuena raro\b/i,
  /\bm[aá]s profesional\b/i,
  /\bm[aá]s simple\b/i,
  /\bmejor redacci[oó]n\b/i,
] as const;

export function detectSegmentCorrectionMode(userText: string): SegmentCorrectionMode {
  const t = userText.trim();
  if (!t) return "add";
  for (const re of REPLACE_RES) {
    if (re.test(t)) return "replace";
  }
  for (const re of IMPROVE_RES) {
    if (re.test(t)) return "improve";
  }
  for (const re of ADDITIVE_RES) {
    if (re.test(t)) return "add";
  }
  return "add";
}

/**
 * When `awaiting_segment_correction` is true, free text should run the extraction LLM
 * unless it is clearly only a segment-control phrase (confirm / pending / help / adjust / frustration).
 */
export function shouldUseSegmentCorrectionLlmPath(
  userText: string,
  awaitingPendingAck: boolean,
): boolean {
  const mode = detectSegmentCorrectionMode(userText);
  if (mode === "replace" || mode === "improve") return true;

  const t = userText.trim();
  const wc = t.split(/\s+/).filter(Boolean).length;
  if (t.length > 56 || wc > 9) return true;

  const seg = classifySegmentConfirmationUserReply({
    userText,
    awaitingPendingAck,
  });
  if (seg === "unknown") return true;

  for (const re of ADDITIVE_RES) {
    if (re.test(t)) return true;
  }

  return false;
}

export function shouldResolveSegmentWhileCorrectionPending(
  userText: string,
  awaitingPendingAck: boolean,
): boolean {
  return !shouldUseSegmentCorrectionLlmPath(userText, awaitingPendingAck);
}

/**
 * Extra instructions appended to the strategic extraction user prompt while correcting a gated segment.
 */
export function buildSegmentCorrectionPromptAppendix(params: {
  miniStep: GuidedMiniStepId;
  mode: SegmentCorrectionMode;
  priorExtractionJson: string;
}): string {
  const modeLine =
    params.mode === "add"
      ? "Modo: complementar (conservar el sentido ya capturado e integrar lo nuevo en una sola redacción)."
      : params.mode === "replace"
        ? "Modo: reemplazar (la nueva respuesta sustituye la interpretación previa de este paso)."
        : "Modo: mejorar redacción (mismo contenido estratégico, redacción más clara; no inventar hechos nuevos).";

  const json = params.priorExtractionJson.trim().slice(0, 12_000);

  const fusionBlock =
    params.mode === "add"
      ? `
- Reescribe los campos de texto relevantes de este paso como UNA redacción integrada (una frase o un párrafo breve), no como “frase anterior + frase nueva” pegadas.
- Conserva el significado ya acordado, incorpora lo nuevo, elimina redundancia y evita repetir literalmente la línea previa si ya queda absorbida en la versión fusionada.
`.trim()
      : "";

  return `
[Ajuste dentro del mismo paso guiado — mini_step=${params.miniStep}]
${modeLine}
- Devuelve un JSON de extracción completo y válido para este mini_step, coherente con las reglas del sistema.
- El bloque JSON previo es la línea base interpretada antes del ajuste; respétalo según el modo.
${fusionBlock ? `\n${fusionBlock}\n` : ""}
JSON previo (solo referencia interna):
${json}
`.trim();
}
