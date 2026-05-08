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
  "Puedes usar tus palabras: confirmar, corregir, pedir una recomendación, o dejar pendiente.",
  "También valen respuestas cortas como «sí», «confirmo» o «dejémoslo pendiente».",
].join("\n");

export function buildSegmentConfirmationAssistantMessage(
  extraction: Pick<IntakeExtractionOutput, "interviewer_message">,
): string {
  const core = extraction.interviewer_message.trim();
  return `Esto es lo que estoy entendiendo:\n\n${core}\n\n¿Confirmas que esta es la respuesta correcta para guardar en el Sistema Límbico?\n\n${SEGMENT_CONFIRM_UI_HINT_ES}`.trim();
}

export function buildPendingSegmentAckQuestion(): string {
  return "¿Confirmas que dejemos esta información pendiente por ahora? Si la dejamos pendiente, Limbi no debe tratarla como un dato ya cerrado.".trim();
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
    /\b(recomendaci[oó]n|recomiendas|qu[eé] opinas|ay[uú]dame)\b/i.test(tFold)
  ) {
    return "help";
  }

  if (
    /\b(corregir|correcci[oó]n|no es as[ií]|no,?\s+eso no|me equivoqu[eé]|mejor dicho)\b/i.test(
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
    /\b(dej[eé]moslo as[ií]|as[ií] est[aá] bien|confirmo que s[ií])\b/i.test(tFold)
  ) {
    return "confirm";
  }

  return "unknown";
}
