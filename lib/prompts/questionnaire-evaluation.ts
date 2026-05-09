import { GLOBAL_AI_RULES } from "@/lib/ai/global-rules";
import { LIMBI_EDITORIAL_STRATEGIC_CANON_INTAKE_EN } from "@/lib/ai/limbi-creative-standard";

/**
 * Prompt en inglés; la salida debe ser JSON (claves en inglés) con textos de usuario citados en español cuando aplique.
 */
export function buildQuestionnaireEvaluationPrompt(params: {
  project_summary: Record<string, unknown>;
  responses_json: string;
  /** Respuestas ya dadas en el flujo de aclaración (re-evaluación post–primera ronda). */
  post_clarification_block?: string | null;
  /**
   * Guided strategic interview: first capture is done; this evaluation may include
   * concrete suggestions in prose fields (unlike strict deferral during live capture).
   */
  guided_strategic_intake_post_capture?: boolean;
}): string {
  const postClar =
    params.post_clarification_block && params.post_clarification_block.trim().length > 0
      ? `

POST_CLARIFICATION_ANSWERS (AUTHORITATIVE — USER ALREADY ANSWERED THESE IN SPANISH)
The user completed a first clarification round. Each block is one answered clarification (question + selection + optional free text). Re-score holistically: acknowledge what became clearer, do not invent facts beyond these answers + STRUCTURED_RESPONSES_JSON, and refresh dimension_scores and clarification_questions accordingly (you may return fewer or zero new clarification_questions if quality is now sufficient).

${params.post_clarification_block.trim()}
`.trim()
      : "";

  const guidedPost =
    params.guided_strategic_intake_post_capture === true
      ? `

GUIDED_STRATEGIC_INTAKE_POST_CAPTURE
The user completed Limbi's guided strategic interview first capture (the classic questionnaire wizard may still be incomplete). This pass is the deepening stage: you may include concrete, actionable suggestions in limbi_detection, why_it_matters, and option labels when they help the user answer. Still ground every clarification question strictly in STRUCTURED_RESPONSES_JSON; never invent audiences, sectors, or roles absent from the user's text.
- Ordering: if the challenge, audience, friction, or promised benefit is still unclear or very thin, ask about those foundations first. Do not lead with evidence-only questions until the core challenge, who it is for, and the central tension are minimally understandable from the user's own words.
- If multiple audience actors or stakeholder labels appear without a clear ordering of who enables resources, who pays, who experiences the offering, or who can block decisions, ask one sharp Spanish question that forces that prioritization using only vocabulary already present.
- If strategic or emotional claims lack supporting evidence in the captured fields, ask what tangible proofs exist today (e.g. track record, clients, cases, testimonials, figures, or allies) without inventing benchmarks — only after the core challenge and audience are sufficiently concrete.
- If the promised benefit or transformation remains vague relative to the stated challenge, ask what would make that benefit clearly worth perceived trade-offs (including price or effort).
`.trim()
      : "";

  return `You are Limbi's intake quality reviewer for a strategic narrative questionnaire (pre–Master Document).

${GLOBAL_AI_RULES}

${LIMBI_EDITORIAL_STRATEGIC_CANON_INTAKE_EN}
${guidedPost}

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
- clarification_questions: array of 0–8 candidate objects (the server may trim to a score-based cap; prefer 0–5 sharply targeted questions). Each object MUST have:
  - id: stable English snake_case unique in this array.
  - limbi_detection: 1–2 short sentences in Spanish — what Limbi noticed (gap, ambiguity, weak evidence, unclear priority). **No internal codes, no English enum ids, no snake_case.**
  - referenced_user_answer: Spanish only — a short **faithful** paraphrase or micro-quote of what the user already wrote/chose. If the stored answer was a single coded wizard value, **translate its meaning in context** (e.g. do NOT output strings like "no_clear_evidence" or "decide_confidently"; instead write natural Spanish such as "Indicaste que aún no hay evidencia clara concreta" or "Buscas que la audiencia pueda decidir con más confianza").
  - why_it_matters: one short Spanish sentence — why answering this improves the Limbic System / Master Document quality.
  - question_text: exactly ONE clear question in Spanish (single ask), strictly grounded in the user's domain words from STRUCTURED_RESPONSES_JSON.
  - options: optional array of { "id": string, "label": string } with 2–5 choices when a discrete preference is natural. Each **label** must be natural Spanish for the end user; **never** expose raw machine ids as labels (ids may stay short English slugs for software only).
  - allow_free_text: boolean (default true) — if true, the UI will offer an optional free-text field in addition to options.
- recommended_next_action: exactly one of:
  - "generate_now" — inputs are adequate; do not block generation.
  - "ask_clarifications" — score likely <80 or important ambiguities; user should answer clarification_questions first.
  - "needs_minimum_context" — critical missing context; still use ask_clarifications path with very targeted questions.

STRICT RULES FOR clarification_questions (NON-NEGOTIABLE)
1) GROUNDING
- Every clarification question MUST be anchored ONLY in facts, phrases, or explicit choices already present in STRUCTURED_RESPONSES_JSON (including project identity, challenge type/explanation, strategic_base, audience_base, evidence_base, voice_base, limbic selections, etc.).
- NEVER introduce audiences, sectors, personas, company archetypes, or roles that are **not** already implied by the user's text (e.g. do not mention "emprendedores", "founders", "B2B buyers", "inversores", "estudiantes", "corporativo", "enterprise") unless those notions or clearly equivalent wording already appear in the user's answers or in the declared challenge/audience fields.
- If the project is about children/families/schools/wellbeing practices, stay inside that vocabulary; do not drift into startup/entrepreneur framing unless the user did.

2) NO INTERNAL CODES IN USER-FACING FIELDS
- Never place raw wizard enum/slug values into referenced_user_answer, limbi_detection, question_text, or option labels (e.g. forbid bare "no_clear_evidence", "decide_confidently", "distrustful", "end_consumers", snake_case tokens).

3) STRUCTURE (each question must include all four prose parts)
- limbi_detection → what Limbi detected.
- referenced_user_answer → what the user already expressed (paraphrased safely).
- why_it_matters → why it matters for the Master Document.
- question_text → one clear question.
- options + allow_free_text as appropriate.

4) EVIDENCE GAPS — forbid generic "past success / case study" templates
- Do NOT ask vague questions like "describe an example of past success or case studies" without tying them to evidence types the user already mentioned.
- Prefer a grounded pattern such as:
  "No hace falta inventar cifras. ¿Qué evidencia real puedes usar hoy: años de experiencia, clientes, colegios, testimonios, observaciones, casos o aprendizajes?"
- Adapt nouns to the actual domain words found in STRUCTURED_RESPONSES_JSON (yoga, centro, familias, escuela, producto, servicio, etc.).

5) AUDIENCE GAPS — no random categories
- Do not invent audience segments. Mirror the project's audience_type and any audience descriptions the user gave.
- If decision-makers are clearly adults (e.g. parents) around an offering for children, ask who actually decides among the plausible adult/stakeholder roles **that already fit the answers** (e.g. parents vs schools vs teachers vs caregivers) and ask for **priority order** — only use roles compatible with the questionnaire text.

6) QUALITY
- Each question materially different, no duplicates, no filler. If POST_CLARIFICATION_ANSWERS is present, avoid repeating resolved topics.

PROJECT_SUMMARY (non-secret metadata)
${JSON.stringify(params.project_summary, null, 2)}

STRUCTURED_RESPONSES_JSON
${params.responses_json}
${postClar ? `\n${postClar}` : ""}
`.trim();
}
