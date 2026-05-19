import type { BrainstormBrandContextStatus } from "@/types/database";
import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";

export { BRAINSTORMER_SESSION_PROMPT_VERSION } from "@/lib/schemas/brainstormer-session";

/** @deprecated BRAIN-8: usar buildConversationalRendererSystemInstructions */
export { buildConversationalRendererSystemInstructions as buildBrainstormerSessionSystemInstructions } from "@/lib/brainstormer/conversational-renderer";

export function buildBrainstormerSessionUserPayload(args: {
  brand_name: string;
  session_title: string;
  brand_context_status: BrainstormBrandContextStatus;
  brand_context_has_pending_updates: boolean;
  brand_context_blocking_reasons: readonly string[];
  session_summary_progress: BrainstormerSessionProgressPayload;
  conversation_excerpt: string;
  conversation_direction_block: string;
}): string {
  return `SESSION METADATA
- Brand name: ${args.brand_name}
- Session title: ${args.session_title}
- brand_context_status (frozen at session creation): ${args.brand_context_status}
- brand_context_has_pending_updates (frozen): ${String(args.brand_context_has_pending_updates)}
- brand_context_blocking_reasons (frozen): ${JSON.stringify([...args.brand_context_blocking_reasons])}

${args.conversation_direction_block}

PROGRESSIVE SESSION SUMMARY (update all session_progress fields in JSON output):
${JSON.stringify(args.session_summary_progress, null, 2)}

CONVERSATION SO FAR (most recent last):
${args.conversation_excerpt}

TASK (Conversational Renderer — BRAIN-8)
Render assistant_message in Spanish strictly following CONVERSATION_DIRECTION above.
Use question_id / question_asks_for / question_reason only as given — do not re-decide strategy.
Close with next_best_question (exactly one question).
Output JSON: assistant_message + session_progress.`;
}
