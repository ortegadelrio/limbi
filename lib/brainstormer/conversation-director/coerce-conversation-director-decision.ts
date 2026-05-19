import { buildFallbackConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/fallback-conversation-director-decision";
import { sanitizeConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/sanitize-conversation-director-decision";
import {
  conversationDirectorDecisionSchema,
  type ConversationDirectorDecision,
  type ResolveConversationDirectorInput,
} from "@/lib/brainstormer/conversation-director/types";

/**
 * Sanitiza y valida la decisión del director; si falla, devuelve fallback seguro.
 */
export function coerceConversationDirectorDecision(
  raw: ConversationDirectorDecision,
  input: ResolveConversationDirectorInput,
): ConversationDirectorDecision {
  const sanitized = sanitizeConversationDirectorDecision(raw);
  const parsed = conversationDirectorDecisionSchema.safeParse(sanitized);
  if (parsed.success) return parsed.data;

  const fallback = buildFallbackConversationDirectorDecision(input);
  const fallbackParsed = conversationDirectorDecisionSchema.safeParse(fallback);
  if (fallbackParsed.success) return fallbackParsed.data;

  return fallback;
}
