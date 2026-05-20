import {
  DEFAULT_THINKING_MODEL_KEY,
  THINKING_MODEL_VERSION,
  buildChallengeTextForThinkingModelResolution,
  buildCompactThinkingModelPromptBlock,
  getThinkingModelByKey,
  isThinkingModelKey,
  resolveThinkingModelForBrainstormer,
  type ResolvedThinkingModel,
  type ThinkingModelKey,
} from "@/lib/ai/thinking-models";
import type { BrainstormSessionRow } from "@/types/database";

export function coerceSessionThinkingModelKey(raw: string | null | undefined): ThinkingModelKey {
  if (raw && isThinkingModelKey(raw)) return raw;
  return DEFAULT_THINKING_MODEL_KEY;
}

export function resolveThinkingForSessionTurn(args: {
  session: BrainstormSessionRow;
  lastUserMessage: string;
  currentChallenge: string;
}): ResolvedThinkingModel {
  const selectedKey = coerceSessionThinkingModelKey(args.session.thinking_model_key);
  const challengeText = buildChallengeTextForThinkingModelResolution({
    sessionTitle: args.session.title,
    currentChallenge: args.currentChallenge,
    lastUserMessage: args.lastUserMessage,
  });

  return resolveThinkingModelForBrainstormer({
    selectedKey,
    challengeText,
  });
}

export function buildThinkingModelBlockForSessionTurn(args: {
  session: BrainstormSessionRow;
  lastUserMessage: string;
  currentChallenge: string;
}): { resolved: ResolvedThinkingModel; block: string } {
  const resolved = resolveThinkingForSessionTurn(args);
  return {
    resolved,
    block: buildCompactThinkingModelPromptBlock({ resolved }),
  };
}

/** Campos a persistir en `brainstorm_sessions` tras resolver en un turno. */
export function thinkingModelFieldsForSessionUpdate(resolved: ResolvedThinkingModel): {
  thinking_model_label: string | null;
  thinking_model_version: string;
  resolved_primary_model_key: ThinkingModelKey;
  resolved_secondary_model_key: ThinkingModelKey | null;
  creative_orientation_summary: string | null;
} {
  const primary = getThinkingModelByKey(resolved.primaryKey);
  const label =
    resolved.selectedKey === "limbi"
      ? resolved.secondaryKey
        ? `${primary?.publicName ?? resolved.primaryKey} + ${getThinkingModelByKey(resolved.secondaryKey)?.publicName ?? resolved.secondaryKey}`
        : primary?.publicName ?? "Limbi"
      : primary?.publicName ?? null;

  return {
    thinking_model_label: label,
    thinking_model_version: THINKING_MODEL_VERSION,
    resolved_primary_model_key: resolved.primaryKey,
    resolved_secondary_model_key: resolved.secondaryKey,
    creative_orientation_summary: resolved.creativeOrientationSummary,
  };
}

// TODO(session-thinking-model-change): PATCH para cambiar thinking_model_key en sesión abierta
// y recalcular resolved_* en el siguiente turno.
