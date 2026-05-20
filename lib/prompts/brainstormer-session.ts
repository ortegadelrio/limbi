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
  /** Nota interna de prompt (p. ej. base de marca actualizada); no exponer nombres técnicos al usuario. */
  brand_context_internal_note?: string | null;
}): string {
  const note = args.brand_context_internal_note?.trim()
    ? `\n${args.brand_context_internal_note.trim()}\n`
    : "";

  return `SESSION METADATA
- Brand name: ${args.brand_name}
- Session title: ${args.session_title}
- brand_context_status (frozen at session creation): ${args.brand_context_status}
- brand_context_has_pending_updates (frozen): ${String(args.brand_context_has_pending_updates)}
- brand_context_blocking_reasons (frozen): ${JSON.stringify([...args.brand_context_blocking_reasons])}
${note}
PROGRESSIVE SESSION SUMMARY (update all session_progress fields in JSON output):
${JSON.stringify(args.session_summary_progress, null, 2)}

CONVERSATION SO FAR (most recent last):
${args.conversation_excerpt}

TASK
Render assistant_message in Spanish from the director block above + THIS TURN in full_input.
Do not re-decide strategy. Optional closing question only if director marks one.
Output JSON: assistant_message + session_progress.`;
}
