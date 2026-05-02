import {
  LIMBI_CREATIVE_STANDARD,
  LIMBI_PURPOSE_AND_OUTCOME_STANDARD,
  LIMBI_SYMBOLIC_INTERPRETATION_STANDARD,
} from "@/lib/ai/limbi-creative-standard";
import type { MasterDocumentStructuredInput } from "@/lib/master-document/build-input";
import { WIZARD_STEP_ORDER } from "@/lib/constants/wizard";
import { MASTER_DOCUMENT_QUALITY_NOTE } from "@/lib/master-document/quality-note";

/**
 * Bloque añadido al reintento cuando la primera respuesta no pasó `validateMasterDocumentOpenAiJson`.
 */
export function buildMasterDocumentValidationRetrySupplement(
  validationMessage: string,
): string {
  return `
SECOND GENERATION ATTEMPT (PREVIOUS JSON REJECTED)
The previous output failed server validation with this exact error:
${validationMessage}

Regenerate the **entire** JSON object from scratch. Every top-level key must be present and valid.

CRITICAL — limbic_base.literal_usage_limits (REQUIRED)
- **limbic_base.literal_usage_limits** is REQUIRED. **Never omit it.** It MUST NOT be null, undefined, or missing.
- It MUST be a JSON **array** of strings (not an object). **Never** use an object for this field.
- Each string MUST be **non-empty** and written in **Spanish** (rules for copy/creative teams: how symbolic inputs may and may not be used).
- If symbolic/sensory inputs are weak or unavailable, you MUST still return **at least 2–3** safe default strings in Spanish that explain, in substance:
  (1) do not use symbolic wizard choices as literal objects or mandatory visuals unless the project context explicitly supports them;
  (2) interpret colors, atmospheres, images and sensory choices as signals of tone, energy, rhythm and emotional field — not as literal scene-setting;
  (3) do not turn selected reference images into decorative copy or slogans.

Also ensure **limbic_base.raw_inputs** and **limbic_base.symbolic_interpretation** are present as objects (never omit limbic_base sub-keys).
`.trim();
}

const PRODUCTION_RULES_ES = [
  "No inventar cifras.",
  "No inventar clientes.",
  "No inventar premios.",
  "No inventar resultados.",
  "No inventar testimonios.",
  "No inventar impacto.",
  "No usar selecciones simbólicas literalmente.",
  "Traducir símbolos del wizard en territorios conceptuales, no en metáforas visibles ni copy literal.",
  "Generar contenidos futuros solo desde este Documento Maestro y el Marco aprobado.",
].join("\n");

/**
 * Blueprint en inglés para una futura llamada a OpenAI.
 * Claves JSON en inglés; todo texto humano del documento debe ir en español.
 */
export function buildMasterDocumentPrompt(
  input: MasterDocumentStructuredInput,
): string {
  const ctx = JSON.stringify(
    {
      project_identity: input.project_identity,
      strategic_context: input.strategic_context,
      audience_context: input.audience_context,
      evidence_context: input.evidence_context,
      limbic_interpretation: input.limbic_interpretation,
      voice_context: input.voice_context,
      raw_responses_keys: Object.keys(input.raw_responses),
    },
    null,
    2,
  );

  return `You are a senior narrative strategist and strategic communication consultant.

${LIMBI_CREATIVE_STANDARD}

${LIMBI_PURPOSE_AND_OUTCOME_STANDARD}

${LIMBI_SYMBOLIC_INTERPRETATION_STANDARD}

LANGUAGE AND FORMAT CONTRACT
- The USER-FACING prompt you are reading is written in English.
- Output MUST be valid JSON.
- JSON keys MUST remain in English (snake_case as specified below).
- ALL human-readable string values inside the JSON — analysis, synthesis, tone descriptions, narrative interpretations, production rules text, and any prose fields — MUST be written in SPANISH.
- Do not mix languages inside string values: Spanish only for human text.

CHALLENGE CONTEXT (USER-STATED INTENT — NOT EVIDENCE)
- When present, **strategic_context.challenge_context.challenge_explanation** is a **priority source** for understanding: (1) **why** the user needs this strategy, (2) **what communication problem** the work must address, and (3) **what the future visible Strategic Narrative Framework must organize** (priorities, tensions, narrative spine).
- Let it **shape** (not replace) your reading of **strategic_base**, **from_project**, and the rest of the inputs: align **strategic diagnosis**, **central tension** (or equivalent synthesis), **input_quality_assessment** (clarity vs vagueness of intent, gaps relative to stated goals), **narrative promise** / strategic through-line, and implications for the **future visible framework** — always grounded in the actual text length and specificity of that field when it exists.
- **Do not invent facts, proof, market data, or outcomes** from **challenge_explanation**. Treat it strictly as **declared user intent and framing** (what they want to solve, order, explain, sell, change, or improve), **not** as verified evidence. If the text is vague, reflect that in **input_quality_assessment** rather than filling gaps with assumptions.

STRATEGIC “PARA QUÉ” IN THE MASTER DOCUMENT (NOT ONLY “QUÉ”)
- The Master Document must **not** read as a catalogue of what the project is or what it offers. It must make the **strategic “para qué”** explicit: **for what** this communication effort exists, **what result** it should help produce, **what benefit or transformation** is sought, and **what perception or action** should move if the narrative works — grounded in **strategic_context** and **audience_context**, not in invented proof.
- Weave **declared wizard intent** from STRUCTURED CONTEXT into synthesis fields (especially **strategic_base**, **audience_base**, **semantic_base** where relevant): e.g. **strategic_context.challenge_context** (challenge type + explanation), **strategic_context.strategic_base** (essence of what it is, promised transformation, why now, central tension, problem framing), **audience_context** (who they are, emotional movement, **desired_action**). Treat these as the user’s stated **communication purpose and outcome**, not as performance metrics.
- **Bad pattern** (Spanish in output): a flat definition like “X es una plataforma que organiza la comunicación” with no link to **why that matters** for the audience or the business.
- **Good pattern**: explain what changes when communication works — e.g. clearer intention, less scattered content, a perception shift, or a decision the audience can finally take — **without** hollow motivational claims or invented KPIs.

NON-NEGOTIABLE RULES
- Do not invent data.
- Distinguish clearly in the document between raw user inputs and your interpretation or synthesis.
- Do not treat symbolic selections as literal content instructions.
- Use limbic_interpretation as symbolic meaning (tone, rhythm, atmosphere, semantic fields, creative constraints), not as literal imagery or mandatory subjects.
- Build ONLY the Narrative Knowledge Master Document (Narrative Knowledge Master).
- Do NOT generate the visible Strategic Narrative Framework yet.
- Do NOT generate pitch lines, captions, content ideas, or graphic phrases yet.

INPUT_QUALITY_ASSESSMENT (HONEST, ACTIONABLE — Spanish strings inside this object)
- You MUST include top-level **input_quality_assessment** EXACTLY as specified in the JSON schema below (all keys required for new generations). This block is a candid diagnosis of how strong the **inputs** are for a future Strategic Framework — not marketing praise.
- **overall_quality_score** (0–100 integer): holistic score for all questionnaire inputs; do NOT inflate — thin or generic inputs must score lower. Do not invent proof to justify a higher score.
- **quality_note** MUST be copied **verbatim** (character-for-character) as:
  ${MASTER_DOCUMENT_QUALITY_NOTE}
- **section_scores** MUST be a **non-empty** array. Each entry diagnoses ONE questionnaire area with a **quality_score** (0–100 integer), **status** ("low"|"medium"|"high"), and Spanish strings **diagnosis**, **why_it_matters**, **recommended_improvement** that reference **concrete wizard gaps** (which questions are vague, missing, or too broad) — avoid generic platitudes.
- For each section row: **section_id** (stable machine slug, English snake_case), **section_label** (short Spanish title shown to the user, may include wizard step name e.g. “Audiencia principal”), **related_wizard_steps** (non-empty array of step ids), **edit_target_step** (single step id — the best step to open first when improving that area). Valid step ids are ONLY these (exact strings):
  ${JSON.stringify(WIZARD_STEP_ORDER)}
- Map sections to the questionnaire, for example (you may merge/split slightly but keep coverage): project identity; challenge type + explanation; main challenge; “what it is” essence; problem/need; promised transformation; audience; emotions + desired action; why now + central tension; evidence; restricted claims; limbic / sensory / visual pulse; voice traits and comparison. Every **edit_target_step** and every **related_wizard_steps** entry MUST be one of the ids above (never invent ids).
- Be honest about **true** gaps (e.g. audience undefined, tension missing, regulatory risk unclear) in **missing_information** / **weaknesses**, but **calibrate tone**: distinguish “not yet available by nature” from “underspecified by the user”.
- Do NOT invent facts, proof, clients, metrics, or strengths that are not grounded in the provided responses and context. Avoid filler strengths; avoid catastrophizing normal early-stage gaps.
- **recommended_questions_to_improve** must be concrete prompts the user could answer in the wizard later (short Spanish questions or instructions), not vague advice.
- **risk_if_generating_framework_now**: one clear Spanish paragraph on what could go wrong if the visible framework were generated immediately with the current input quality (e.g. generic marco, weak tension, compliance risk with evidence gaps).
- **can_generate_framework**: boolean — set **false** if, in your judgment, critical gaps would likely produce a weak framework; **true** if inputs are adequate or only minor gaps remain. This is advisory only for downstream UX; still be truthful.

INPUT_QUALITY_ASSESSMENT — CONTEXTUAL MISSING INFORMATION (CALM, NON-ALARMIST — Spanish prose)
- Do **not** assume that every absent data point is a severe weakness or that the project is “weak” because history is thin.
- If the context suggests an **early-stage** venture, **new brand**, **new product**, **idea**, **planned event**, or **pre-revenue** initiative, explicitly acknowledge that **testimonials, hard metrics, awards, case studies, or long track records may not exist yet** — that is normal, not a moral failure.
- In those cases, **recommended_improvement** and **recommended_questions_to_improve** must stay **useful and calm**: suggest alternatives the user can add **without inventing proof**, for example: hypotheses, market observations, audience assumptions (labeled as assumptions), benchmarks, early qualitative learnings, studies, founder vision, intended positioning, constraints, desired perception shift, honest “what we know vs what we assume”.
- **Never** imply the user must fabricate results. **Never** use shaming or anxiety-inducing language. Prefer encouraging, practical guidance.
- Clearly distinguish in your reasoning (and reflect it in scores/text): (1) **critical** missing information that would block a coherent narrative; (2) **useful but optional** depth; (3) **evidence that is desirable but not yet available**; (4) **strategic assumptions** that can be declared honestly instead of “hard evidence”.
- When scoring **section_scores**, do **not** harshly punish a new project solely for lacking past outcomes if the user has provided enough **intent, audience framing, constraints, and strategic context** to build a narrative. Penalize vagueness where it matters, not the absence of a history that cannot exist yet.
- Good vs bad pattern for **recommended_improvement** (Spanish):  
  - **Good** (example tone): “Si todavía no tienes resultados porque el proyecto está comenzando, no necesitas inventarlos. Puedes enriquecer esta sección con estudios de referencia, hipótesis de audiencia, aprendizajes iniciales o señales cualitativas que expliquen por qué esta propuesta importa.”  
  - **Bad**: a cold list like “Faltan resultados, testimonios y casos de éxito” presented as mandatory proof.

SYMBOLIC SELECTIONS → CONCEPTUAL TERRITORIES (CRITICAL)
- Wizard symbolic selections (images, places, objects, scenes named in raw data) are **internal interpretive signals** only. They are NOT prompts for visible metaphors, headlines, or literal imagery in downstream content.
- In **semantic_base** (including **metaphorical_axes** and any thematic / semantic synthesis fields), write **conceptual territories**: abstract narrative qualities, emotional vectors, relational dynamics, and strategic meaning — **not** labels that restate the symbol (“hogar”, “escenario”, “aeropuerto”, “mar”, “cohete”, etc.) as if they were creative devices to show in copy.
- **Avoid naming those selected symbols directly** inside semantic_base prose unless the **project_identity or evidence_base** explicitly establishes them as real-world subjects the brand must discuss (e.g. the business literally operates in that domain). Default: no echo of wizard asset/slug names in semantic_base.
- **limbic_base.literal_usage_limits** is **REQUIRED** (same importance as other top-level blocks). **Never omit the key.** It MUST be a JSON **array of non-empty Spanish strings** (never an object, never null). The array **must not be empty** — use **at least 2–3** prudent default strings in Spanish if inputs are thin (no literalization of symbols unless context forces it; colors/images as tone signals not mandatory visuals; no decorative copy from reference images).
- **literal_usage_limits** (under limbic_base and echoed in production_rules where relevant) must stay **explicit and concrete**: clearly forbid treating symbolic picks as mandatory visuals, slogans, or literal scene-setting unless strategically justified later outside this document.
- Downstream content generated from this master document should **not** surface symbolic images as literal metaphors unless a future strategic layer explicitly justifies it; encode that discipline here.
- Good vs bad pattern (Spanish in output): prefer conceptual bundles over “X as Y” where X is the wizard symbol.
  - Bad: “hogar como acogida y raíces” → Good: “acogida, pertenencia y seguridad emocional”.
  - Bad: “escenario como presencia y momento cumbre” → Good: “presencia pública, reconocimiento y momento de visibilidad”.
  - Bad: “aeropuerto como transición y expansión” → Good: “transición, escala, apertura y expansión”.
  - Bad: “cohete como aceleración y futuro” → Good: “aceleración, ambición, salto cualitativo y proyección futura”.

GLOBAL AI RULES (apply strictly; echo them inside production_rules in Spanish where appropriate)
${input.global_ai_rules}

PRODUCTION RULES (embed as Spanish strings under production_rules; include at least the following concepts — you may phrase them clearly without losing meaning)
${PRODUCTION_RULES_ES}

STRUCTURED CONTEXT (read carefully; do not fabricate fields beyond these sources)
${ctx}

OUTPUT REQUIREMENTS
- Output must be valid JSON.
- JSON keys must remain in English exactly as in this schema outline.
- All human-readable text values, analysis, synthesis, tone descriptions, narrative interpretations and production rules must be written in Spanish.

REQUIRED TOP-LEVEL JSON SHAPE
{
  "project_identity": {},
  "raw_inputs": {},
  "strategic_base": {},
  "audience_base": {},
  "evidence_base": {},
  "limbic_base": {
    "raw_inputs": {},
    "symbolic_interpretation": {},
    "literal_usage_limits": [
      "Ejemplo: no usar las elecciones simbólicas del cuestionario como objetos literales obligatorios salvo que el contexto del proyecto lo respalde.",
      "Ejemplo: interpretar color, atmósfera e imágenes de referencia como señales de tono y campo emocional, no como escenografía literal en el copy."
    ]
  },
  "voice_base": {},
  "semantic_base": {},
  "production_rules": {},
  "input_quality_assessment": {
    "overall_readiness": "low" | "medium" | "high",
    "overall_quality_score": 0,
    "quality_note": "(MUST equal the exact string specified in INPUT_QUALITY_ASSESSMENT rules)",
    "section_scores": [
      {
        "section_id": "",
        "section_label": "",
        "related_wizard_steps": [],
        "quality_score": 0,
        "status": "low" | "medium" | "high",
        "diagnosis": "",
        "why_it_matters": "",
        "recommended_improvement": "",
        "edit_target_step": ""
      }
    ],
    "strengths": [],
    "weaknesses": [],
    "missing_information": [],
    "recommended_questions_to_improve": [],
    "risk_if_generating_framework_now": "",
    "can_generate_framework": true
  },
  "memory": {
    "approved_outputs": [],
    "rejected_outputs": [],
    "favorite_outputs": [],
    "user_edits": [],
    "tone_adjustments": [],
    "version_history": []
  }
}

MAPPING GUIDANCE
- Populate raw_inputs from the wizard payload (see raw_responses in server data); keep user wording faithful.
- Populate strategic_base, audience_base, evidence_base, voice_base from the same factual sources; Spanish narrative prose where synthesis is needed.
- For limbic_base.raw_inputs use limbic data from raw_responses; limbic_base.symbolic_interpretation must reflect limbic_interpretation from context; **limbic_base.literal_usage_limits** MUST always be present as an **array of non-empty Spanish strings** (see REQUIRED rules above) — merge any literal_usage_limits from interpretation when present, otherwise use safe defaults; keep limits **explicit** (what not to do with symbols in future copy and visuals).
- semantic_base: Spanish semantic / thematic synthesis grounded only in provided inputs. If you include **metaphorical_axes** (or similar arrays/objects), each entry must read as a **conceptual territory** (clusters of abstract meanings, tensions, arcs) — **never** as a restatement of the wizard’s symbolic image as a visible metaphor. Do not chain “[symbol] como …” patterns tied to wizard picks unless project context forces a literal subject.
- production_rules: object whose string values are Spanish rules (include the non-invention and symbolic rules above, plus global_ai_rules ideas in Spanish).
- input_quality_assessment: follow INPUT_QUALITY_ASSESSMENT rules above (including **CONTEXTUAL MISSING INFORMATION**); **section_scores** must be non-empty; **quality_note** must match verbatim; arrays **strengths**/**weaknesses**/etc. may be empty only if truly nothing to list in that category, but **risk_if_generating_framework_now** must always be a substantive Spanish paragraph.
- memory: may be empty arrays initially.

GENERATION METADATA (for your reasoning only — do not add extra top-level keys outside the schema unless they are inside an allowed object)
${JSON.stringify(input.generation_instructions, null, 2)}
`;
}
