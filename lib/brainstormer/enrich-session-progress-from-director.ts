import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import type { BrainstormerDetectedBrandSignals } from "@/lib/brainstormer/brand-signals-from-active-base";
import { dedupeSessionProgressFields } from "@/lib/brainstormer/dedupe-session-progress";
import {
  extractSessionContextSignals,
  inferSessionChallenge,
  inferSessionDecisions,
  inferSessionDirection,
  inferSessionNextStep,
  isGenericChallengeText,
  isGenericNextStepText,
} from "@/lib/brainstormer/session-context-inference";
import {
  textMentionsThirdPartyIp,
  THIRD_PARTY_IP_GUARDRAIL_NOTE_ES,
} from "@/lib/brainstormer/third-party-ip-guardrail";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";

function textMentionsThirdPartyIpInBlock(text: string): boolean {
  return text
    .split(/\n+/)
    .some((line) => textMentionsThirdPartyIp(line));
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function appendUniqueBullets(existing: string, bullets: string[]): string {
  const current = existing
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–*]+/, "").trim())
    .filter(Boolean);
  const merged = [...current];
  for (const b of bullets) {
    const norm = b.toLowerCase();
    if (!merged.some((m) => m.toLowerCase() === norm || m.toLowerCase().includes(norm))) {
      merged.push(b);
    }
  }
  if (merged.length === 0) return "";
  return merged.map((line) => `- ${line}`).join("\n");
}

export type EnrichSessionProgressContext = {
  conversation_excerpt: string;
  user_message: string;
  brand_signals?: BrainstormerDetectedBrandSignals;
};

/**
 * Completa y depura session_progress con señales del Director y del hilo (sin prompts).
 */
export function enrichSessionProgressFromDirector(
  progress: BrainstormerSessionProgressPayload,
  director: ConversationDirectorDecision,
  context?: EnrichSessionProgressContext,
): BrainstormerSessionProgressPayload {
  const corpus = context
    ? `${context.conversation_excerpt}\n${context.user_message}`
    : "";
  const signals = extractSessionContextSignals(
    corpus,
    director,
    context?.user_message ?? "",
  );

  const out: BrainstormerSessionProgressPayload = { ...progress };

  const inferredChallenge = inferSessionChallenge(signals, director, out);
  if (
    inferredChallenge &&
    (!hasText(out.current_challenge) || isGenericChallengeText(out.current_challenge))
  ) {
    out.current_challenge = inferredChallenge;
  }

  const inferredDirection = inferSessionDirection(signals, out);
  if (inferredDirection) {
    out.preliminary_objective = inferredDirection;
  }

  const inferredDecisions = inferSessionDecisions(signals, director);
  if (inferredDecisions.length > 0) {
    out.ideas_explored = appendUniqueBullets(out.ideas_explored, inferredDecisions);
  }

  const inferredNext = inferSessionNextStep(signals, director, out);
  if (
    inferredNext &&
    (!hasText(out.next_step) || isGenericNextStepText(out.next_step))
  ) {
    out.next_step = inferredNext;
  } else if (
    hasText(out.next_step) &&
    isGenericNextStepText(out.next_step) &&
    director.should_generate_content_now &&
    director.current_deliverable_section
  ) {
    out.next_step = `Desarrollar la sección «${director.current_deliverable_section}».`;
  }

  if (signals.third_party_ip_risk && !textMentionsThirdPartyIpInBlock(out.ideas_explored)) {
    out.ideas_explored = appendUniqueBullets(out.ideas_explored, [
      THIRD_PARTY_IP_GUARDRAIL_NOTE_ES,
    ]);
    if (out.preliminary_objective && /fifa|mundial 2026/i.test(out.preliminary_objective)) {
      out.preliminary_objective = inferSessionDirection(signals, { ...out, preliminary_objective: "" }) ?? out.preliminary_objective;
    }
  }

  if (director.should_request_user_material && !signals.no_material) {
    out.open_questions = appendUniqueBullets(out.open_questions, [
      "Compartir insumos (notas, brief o archivo) antes de redactar piezas finales.",
    ]);
  }

  if (
    signals.has_conference_deliverable &&
    !hasText(out.open_questions) &&
    !signals.building_section
  ) {
    out.open_questions = appendUniqueBullets(out.open_questions, [
      "Desarrollar estructura de la conferencia.",
      "Construir secciones en profundidad.",
    ]);
  }

  return dedupeSessionProgressFields(out);
}
