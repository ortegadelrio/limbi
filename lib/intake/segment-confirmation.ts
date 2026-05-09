import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { detectStrategicHelpOrHowToRequest } from "@/lib/intake/conversational-engine/strategic-help-request";
import { audienceWizardSlugToSpanishLabel } from "@/lib/intake/segment-confirmation-actions";

export type SegmentConfirmationUserReplyKind =
  | "confirm"
  | "correct"
  | "help"
  | "pending_missing_info"
  | "pending_ack_confirm"
  | "frustration"
  | "unknown";

/** @deprecated Long free-text hints; UI uses action buttons. Kept for backwards-compatible tests only. */
export const SEGMENT_CONFIRM_UI_HINT_ES =
  "Puedes usar los botones de confirmación cuando aparezcan, o responder con tus palabras.";

/** Generic praise, market diagnosis, or evaluative boilerplate — not persisted in confirmation unless the user said it. */
const SEGMENT_CONFIRM_EVAL_BOILERPLATE_RES: RegExp[] = [
  /\balt[oa]s?\s+potencial(es)?\b/i,
  /\bmercado\s+saturad[oa]\b/i,
  /\bmercado\s+competitivo\b/i,
  /propuesta\s+de\s+valor\s+distinta/i,
  /\bresuena\s+con\b/i,
  /\betapa\s+de\s+vida\b/i,
  /\betapa\s+crucial\b/i,
  /\boportunidades?\s+de\s+personalizaci[oó]n\b/i,
  /\bpotencial\s+fuerte\b/i,
  /\bgran\s+oportunidad\b/i,
  /\bfuerte\s+posicionamiento\b/i,
  /\bdiferenciaci[oó]n\s+clave\b/i,
  /\bvalor\s+estratégico\b/i,
  /\boportunidad(es)?\s+de\s+mercado\b/i,
];

/**
 * Removes sentences that are mostly generic market evaluation or praise, so the
 * confirmation line stays short and tied to what the user actually said.
 */
export function sanitizeInterpretationCoreForSegmentConfirmation(core: string): string {
  const t = core.trim();
  if (!t) return t;

  const sentences = t
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = sentences.length > 0 ? sentences : [t];
  const kept = chunks.filter(
    (sentence) => !SEGMENT_CONFIRM_EVAL_BOILERPLATE_RES.some((re) => re.test(sentence)),
  );
  const joined = kept.join(" ").replace(/\s+/g, " ").trim();
  return joined.length > 0 ? joined : t;
}

function readRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function stripTerminalPeriod(s: string): string {
  const t = s.trim();
  if (t.endsWith(".")) return t.slice(0, -1).trim();
  return t;
}

/**
 * One-line confirmation body from structured extraction (preferred over model interviewer_message).
 */
export function buildSegmentConfirmationStructuredCore(
  extraction: Pick<IntakeExtractionOutput, "interviewer_message" | "extracted_response_updates">,
  miniStep: GuidedMiniStepId,
): string {
  const upd = readRecord(extraction.extracted_response_updates);
  const sb = readRecord(upd.strategic_base);
  const ab = readRecord(upd.audience_base);
  const eb = readRecord(upd.evidence_base);

  if (miniStep === "tailored_what") {
    const d =
      typeof sb.simple_description === "string"
        ? sanitizeInterpretationCoreForSegmentConfirmation(sb.simple_description)
        : "";
    if (d.length > 0) return `Ofreces ${stripTerminalPeriod(d)}.`;
  }
  if (miniStep === "problem") {
    const p =
      typeof sb.problem_description_optional === "string"
        ? sanitizeInterpretationCoreForSegmentConfirmation(sb.problem_description_optional)
        : "";
    if (p.length > 0) return `La fricción central es ${stripTerminalPeriod(p)}.`;
  }
  if (miniStep === "transformation") {
    const to =
      typeof sb.transformation_to === "string"
        ? sanitizeInterpretationCoreForSegmentConfirmation(sb.transformation_to)
        : "";
    if (to.length > 0) return `El beneficio a comunicar es ${stripTerminalPeriod(to)}.`;
  }
  if (miniStep === "audience") {
    const desc =
      typeof ab.audience_description_optional === "string"
        ? sanitizeInterpretationCoreForSegmentConfirmation(ab.audience_description_optional)
        : "";
    if (desc.length > 0) return `La audiencia quedaría así: ${stripTerminalPeriod(desc)}.`;
    const slug =
      typeof ab.audience_type === "string"
        ? sanitizeInterpretationCoreForSegmentConfirmation(ab.audience_type)
        : "";
    if (slug.length > 0) {
      const human = audienceWizardSlugToSpanishLabel(slug);
      return `La audiencia principal quedaría orientada a: ${stripTerminalPeriod(human)}.`;
    }
  }
  if (miniStep === "evidence") {
    const types = eb.evidence_types;
    if (Array.isArray(types) && types.includes("no_clear_evidence")) {
      return "La evidencia queda pendiente.";
    }
    if (Array.isArray(types) && types.length > 0) {
      const joined = types.map((x) => String(x).trim()).filter(Boolean).join(", ");
      if (joined.length > 0) return `La evidencia registrada incluye estos tipos: ${joined}.`;
    }
    const details = eb.evidence_details;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      const keys = Object.keys(details as Record<string, unknown>).filter((k) => {
        const v = (details as Record<string, unknown>)[k];
        return typeof v === "string" && String(v).trim().length > 0;
      });
      if (keys.length > 0) return `La evidencia disponible está anotada en: ${keys.join(", ")}.`;
    }
  }

  return sanitizeInterpretationCoreForSegmentConfirmation(extraction.interviewer_message.trim());
}

export function buildSegmentConfirmationAssistantMessage(
  extraction: Pick<IntakeExtractionOutput, "interviewer_message" | "extracted_response_updates">,
  miniStep?: GuidedMiniStepId,
): string {
  const structured =
    miniStep !== undefined &&
    miniStep !== "challenge_type" &&
    miniStep !== "complete"
      ? buildSegmentConfirmationStructuredCore(extraction, miniStep)
      : "";
  const core =
    structured.length > 0
      ? structured
      : sanitizeInterpretationCoreForSegmentConfirmation(extraction.interviewer_message.trim());
  return `Lo guardaría así:\n${core}`.trim();
}

/** Help during segment confirmation: grounded structured line + same triad (no generic strategic validation essay). */
export function buildSegmentConfirmationHelpAssistantReply(
  extraction: Pick<IntakeExtractionOutput, "interviewer_message" | "extracted_response_updates">,
  miniStep: GuidedMiniStepId,
): string {
  const core = buildSegmentConfirmationStructuredCore(extraction, miniStep);
  return `Te propongo dejarlo así:\n${core}`.trim();
}

export function buildPendingSegmentAckQuestion(): string {
  return "¿Confirmas que la dejemos pendiente por ahora? Mientras esté pendiente, Limbi no la tratará como un dato cerrado.".trim();
}

export function classifySegmentConfirmationUserReply(params: {
  userText: string;
  awaitingPendingAck: boolean;
}): SegmentConfirmationUserReplyKind {
  const t = params.userText.trim().toLowerCase();
  const tFold = t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (tFold.length < 1) return "unknown";

  if (params.awaitingPendingAck) {
    if (
      /\b(ya te respond[ií]|ya respond[ií]|eso ya lo dije|ya te dije|ya lo dije)\b/i.test(tFold)
    ) {
      return "frustration";
    }
    if (
      /^(s[ií]|ok|vale|confirmo|exacto|adelante|dale)(?=[\s,.;:!?]|$)/u.test(tFold) ||
      /\b(confirmo que quede pendiente|s[ií],?\s+pendiente|dej[aé]moslo as[ií])\b/i.test(
        tFold,
      )
    ) {
      return "pending_ack_confirm";
    }
    return "unknown";
  }

  if (
    /\b(ya te respond[ií]|ya respond[ií]|eso ya lo dije|ya te dije|ya lo dije)\b/i.test(tFold)
  ) {
    return "frustration";
  }

  if (
    /\b(ajustemos|ajusta|quiero ajustar|lo ajustamos|corrijamos|quiero corregir|no,?\s*eso no|eso no es|no esta bien|no está bien|mejor dicho|cambiemoslo|cambi[eé]moslo|hay que corregir|hay que ajustarlo)\b/i.test(
      tFold,
    )
  ) {
    return "correct";
  }

  if (
    /\b(no tengo|sin informaci[oó]n|no dispongo|no cuento con|falta informaci[oó]n|dejarlo pendiente|dejemoslo pendiente|dej[eé]moslo pendiente|lo dejamos pendiente|pendiente(?!\s+confirm)|mas tarde|m[aá]s tarde|lo revisamos despues|lo revisamos despu[eé]s|no tengo esa informaci[oó]n|no lo se todavia|no lo se todav[ií]a|no lo s[eé] todav[ií]a)\b/i.test(
      tFold,
    )
  ) {
    return "pending_missing_info";
  }

  if (
    detectStrategicHelpOrHowToRequest(params.userText) ||
    /\b(recomendaci[oó]n|recomiendas|qu[eé] opinas|ay[uú]dame|ay[uú]dame a mejorarlo|mejorarlo conmigo|mejoralo|mej[oó]ralo|hazlo mejor|prop[oó]n|dame una recomendaci[oó]n)\b/i.test(
      tFold,
    )
  ) {
    return "help";
  }

  if (
    /^(s[ií]|ok|vale|confirmo|exacto|correcto|claro|listo|dale|perfecto|adelante)(?=[\s,.;:!?]|$)/u.test(
      tFold,
    ) ||
    /^confirmar(?=[\s,.;:!?]|$)/iu.test(tFold) ||
    /\b(esta bien|est[aá] bien|as[ií] esta bien|as[ií] está bien|dejemoslo asi|dej[eé]moslo as[ií]|dejalo asi|d[eé]jalo as[ií]|me sirve|confirmo que s[ií]|s[ií],?\s+as[ií] est[aá] bien|de acuerdo)\b/i.test(
      tFold,
    )
  ) {
    return "confirm";
  }

  return "unknown";
}
