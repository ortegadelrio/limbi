import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { detectStrategicHelpOrHowToRequest } from "@/lib/intake/conversational-engine/strategic-help-request";

export type SegmentConfirmationUserReplyKind =
  | "confirm"
  | "correct"
  | "help"
  | "pending_missing_info"
  | "pending_ack_confirm"
  | "unknown";

export const SEGMENT_CONFIRM_UI_HINT_ES = [
  "Por ejemplo: «sí, así está bien», «quiero ajustar», «ayúdame a mejorarlo» o «dejémoslo pendiente».",
  "También valen «confirmar», «sí» o «dejémoslo pendiente».",
].join("\n");

/** Generic praise, market diagnosis, or evaluative boilerplate — not persisted in confirmation unless the user said it. */
const SEGMENT_CONFIRM_EVAL_BOILERPLATE_RES: RegExp[] = [
  /\balt[oa]s?\s+potencial(es)?\b/i,
  /\bmercado\s+saturad[oa]\b/i,
  /\bmercado\s+competitivo\b/i,
  /propuesta\s+de\s+valor\s+distinta/i,
  /\bresuena\s+con\b/i,
  /\betapa\s+de\s+vida\b/i,
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

export function buildSegmentConfirmationAssistantMessage(
  extraction: Pick<IntakeExtractionOutput, "interviewer_message">,
): string {
  const core = sanitizeInterpretationCoreForSegmentConfirmation(extraction.interviewer_message.trim());
  return `Lo guardaría así:\n${core}\n\n¿Lo dejamos así, lo ajustamos o lo dejamos pendiente?\n\n${SEGMENT_CONFIRM_UI_HINT_ES}`.trim();
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
    /\b(no tengo|sin informaci[oó]n|no dispongo|no cuento con|falta informaci[oó]n)\b/i.test(
      tFold,
    )
  ) {
    return "pending_missing_info";
  }

  if (
    detectStrategicHelpOrHowToRequest(params.userText) ||
    /\b(recomendaci[oó]n|recomiendas|qu[eé] opinas|ay[uú]dame|ay[uú]dame a mejorarlo|mejorarlo conmigo)\b/i.test(
      tFold,
    )
  ) {
    return "help";
  }

  if (
    /\b(corregir|correcci[oó]n|no es as[ií]|no,?\s+eso no|me equivoqu[eé]|mejor dicho|quiero ajustar|lo ajustamos|hay que ajustarlo)\b/i.test(
      tFold,
    )
  ) {
    return "correct";
  }

  if (
    /\b(dej[eé]moslo pendiente|dejar pendiente|pendiente por ahora|lo vemos despu[eé]s)\b/i.test(
      tFold,
    )
  ) {
    return "pending_missing_info";
  }

  if (
    /^(s[ií]|ok|vale|confirmo|exacto|correcto|claro|listo)(?=[\s,.;:!?]|$)/u.test(tFold) ||
    /^confirmar(?=[\s,.;:!?]|$)/iu.test(tFold) ||
    /\b(dej[eé]moslo as[ií]|as[ií] est[aá] bien|confirmo que s[ií]|s[ií],?\s+as[ií] est[aá] bien)\b/i.test(
      tFold,
    )
  ) {
    return "confirm";
  }

  return "unknown";
}
