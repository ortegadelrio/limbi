import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { pilotMainQuestionText } from "@/lib/intake/question-bank";
import type { PilotEscapeChipId } from "@/lib/intake/question-bank";

export const LIMBIC_INTERVIEW_TRACE_KEY = "_limbic_interview_v1" as const;

export type LimbicInterviewTraceV1 = {
  version: 1;
  pilot_id: "offering_module_v1";
  phase: "main" | "follow_up" | "done";
  follow_up_used: boolean;
  /** Short audit trail (not full raw chat for master). */
  turns: { at: string; role: "user" | "assistant"; summary: string }[];
};

export function readInterviewTrace(
  responses: Record<string, unknown>,
): LimbicInterviewTraceV1 | null {
  const raw = responses[LIMBIC_INTERVIEW_TRACE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || o.pilot_id !== "offering_module_v1") return null;
  const phase = o.phase;
  if (phase !== "main" && phase !== "follow_up" && phase !== "done") {
    return null;
  }
  return {
    version: 1,
    pilot_id: "offering_module_v1",
    phase,
    follow_up_used: Boolean(o.follow_up_used),
    turns: Array.isArray(o.turns)
      ? (o.turns as unknown[])
          .filter(
            (t): t is LimbicInterviewTraceV1["turns"][number] =>
              t !== null &&
              typeof t === "object" &&
              !Array.isArray(t) &&
              typeof (t as Record<string, unknown>).at === "string" &&
              ((t as Record<string, unknown>).role === "user" ||
                (t as Record<string, unknown>).role === "assistant") &&
              typeof (t as Record<string, unknown>).summary === "string",
          )
          .map((t) => {
            const x = t as Record<string, unknown>;
            return {
              at: x.at as string,
              role: x.role as "user" | "assistant",
              summary: x.summary as string,
            };
          })
      : [],
  };
}

export function initialTrace(): LimbicInterviewTraceV1 {
  return {
    version: 1,
    pilot_id: "offering_module_v1",
    phase: "main",
    follow_up_used: false,
    turns: [],
  };
}

export function appendTurn(
  trace: LimbicInterviewTraceV1,
  role: "user" | "assistant",
  summary: string,
): LimbicInterviewTraceV1 {
  const next = [...trace.turns, { at: new Date().toISOString(), role, summary }];
  return { ...trace, turns: next.slice(-20) };
}

export function buildOfferingPilotSystemPrompt(params: {
  challengeType: string | null;
  /** If already chosen in responses */
  offeringTypeHint: string | null;
}): string {
  const mainQ = pilotMainQuestionText(params.challengeType);
  return `You are Limbi, a strategic communication interviewer (not a copywriter).
Rules:
- Strategy first, narrative second, format last.
- Ask for the "para qué" and the problem/situation the offer resolves.
- Do NOT generate final campaign copy, headlines, or ads.
- Output MUST be a single JSON object matching the schema described in the user message.
- extracted_response_updates.strategic_base may only include these keys when set:
  simple_description, offering_type, problem_category, problem_description_optional,
  transformation_type, transformation_from, transformation_to, guided_intake_limitations_optional
- Use standard slug values for offering_type, problem_category, transformation_type as in Limbi wizard enums (product, service, experience, knowledge, community, solution for offering_type; problem categories like lack_clarity, lack_trust, etc.; transformation types like understand_better, decide_confidently, etc.).
- If information is missing, put reasons in guided_intake_limitations_optional string array and lower confidence.
- needs_follow_up: true only if the last user answer is vague AND you could clarify with ONE short strategic question.
- Maximum one follow-up in the whole pilot: if the conversation state says a follow-up was already used, set needs_follow_up to false.
- public_copy_allowed: false unless every extracted field you filled is explicit and safe for downstream synthesis.

Main question the user already saw (for context): ${JSON.stringify(mainQ)}

Project challenge_type (may be null): ${JSON.stringify(params.challengeType)}
Offering_type already in responses (may be null): ${JSON.stringify(params.offeringTypeHint)}
`.trim();
}

export function buildOfferingPilotUserPrompt(params: {
  trace: LimbicInterviewTraceV1;
  userText: string;
  strategicBaseSnapshot: Record<string, unknown>;
}): string {
  const followUpAlready = params.trace.follow_up_used;
  return `Current strategic_base snapshot (JSON):
${JSON.stringify(params.strategicBaseSnapshot, null, 2)}

Interview phase: ${params.trace.phase}
Follow-up already used in this pilot: ${followUpAlready ? "yes" : "no"}

User message:
${params.userText}

Return the extraction JSON as specified. If follow-up already used is yes, needs_follow_up MUST be false.
`.trim();
}

export function buildSyntheticExtractionForChip(
  action: PilotEscapeChipId,
): IntakeExtractionOutput {
  const lim: string[] = [];
  if (action === "no_info") {
    lim.push("guided_intake:user_no_info");
  } else if (action === "improve_later") {
    lim.push("guided_intake:user_improve_later");
  } else {
    lim.push("guided_intake:user_continue_with_base");
  }
  return {
    extracted_response_updates: {
      strategic_base: {
        guided_intake_limitations_optional: lim,
      },
    },
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "skipped",
    target_response_paths: ["strategic_base.guided_intake_limitations_optional"],
    internal_notes: `User selected escape chip: ${action}`,
    public_copy_allowed: false,
  };
}
