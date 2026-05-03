import { GLOBAL_AI_RULES } from "@/lib/ai/global-rules";

/**
 * Prompt en inglés; la salida debe ser JSON (claves en inglés) con textos de usuario citados en español cuando aplique.
 */
export function buildQuestionnaireEvaluationPrompt(params: {
  project_summary: Record<string, unknown>;
  responses_json: string;
}): string {
  return `You are Limbi's intake quality reviewer for a strategic narrative questionnaire (pre–Master Document).

${GLOBAL_AI_RULES}

TASK
- Read the full questionnaire answers (Spanish user content) in STRUCTURED_RESPONSES_JSON.
- Assess whether the inputs are sufficient to build a strong Narrative Knowledge Master Document without inventing facts.
- Return ONE JSON object matching the schema below exactly (no markdown fences).

SCHEMA (all keys required)
- overall_quality_score: integer 0–100 (holistic; do not inflate thin inputs).
- dimension_scores: object mapping short English snake_case dimension keys to integers 0–100. Include at least: strategic_clarity, audience_definition, evidence_and_claims, emotional_narrative, voice_and_tone, limbic_signals_usability.
- critical_gaps: array of short Spanish strings (each non-empty) describing the most important gaps.
- contradictions: array of short Spanish strings (possibly empty if none detected).
- missing_information: array of short Spanish strings for missing info (can overlap gaps but be specific).
- clarification_questions: array of 2–6 objects. Each object MUST have:
  - id: stable English snake_case unique in this array.
  - referenced_user_answer: short verbatim or tight paraphrase of what the user already said (Spanish).
  - why_it_matters: one short Spanish sentence explaining why clarifying improves the Limbic System.
  - question_text: ONE clear question in Spanish (single ask).
  - options: optional array of { "id": string, "label": string } with 2–5 choices when a discrete preference is natural; otherwise omit or use empty array.
  - allow_free_text: boolean (default true) — if true, the UI will offer an optional free-text field in addition to options.
- recommended_next_action: exactly one of:
  - "generate_now" — inputs are adequate; do not block generation.
  - "ask_clarifications" — score likely <80 or important ambiguities; user should answer clarification_questions first.
  - "needs_minimum_context" — critical missing context; still use ask_clarifications path with very targeted questions.

RULES FOR clarification_questions
- Each question references the user's previous answer (field referenced_user_answer).
- Ask only ONE thing per question_text.
- Prefer concrete options when possible (positioning, priority, audience segment, risk tolerance).
- Never ask the user to re-fill the entire questionnaire.
- Do not invent facts about the user's business.

PROJECT_SUMMARY (non-secret metadata)
${JSON.stringify(params.project_summary, null, 2)}

STRUCTURED_RESPONSES_JSON
${params.responses_json}
`.trim();
}
