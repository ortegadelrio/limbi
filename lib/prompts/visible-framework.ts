import {
  LIMBI_BINARY_CLICHE_COPY_STANDARD,
  LIMBI_CREATIVE_STANDARD,
  LIMBI_PURPOSE_AND_OUTCOME_STANDARD,
  LIMBI_STRATEGIC_NEGATIVE_MATERIAL_STANDARD,
  LIMBI_SYMBOLIC_INTERPRETATION_STANDARD,
} from "@/lib/ai/limbi-creative-standard";
import type { VisibleFrameworkStructuredInput } from "@/lib/framework/build-input";

/**
 * Blueprint en inglés para generar el Marco Estratégico Narrativo visible (JSON interno).
 * Claves JSON en inglés; textos humanos del marco en español.
 */
export function buildVisibleFrameworkPrompt(
  input: VisibleFrameworkStructuredInput,
): string {
  const ctx = JSON.stringify(input, null, 2);

  return `You are a senior narrative strategist. Your task is to produce a **deep, useful Strategic Narrative Framework** (Marco Estratégico Narrativo visible): strategic diagnosis, expected communication outcomes, conflicts, risks, evidence gaps, narrative opportunity, message architecture, available proof, limits, recommendations, and success signals.

CREATIVE PRIORITY HIERARCHY (when sources conflict)
- Master Document subset in STRUCTURED INPUT > evidence_base > production_rules > guardrails > revision_context (if present) > stylistic and symbolic interpretation per Limbi standards below. Never invert this order.

${LIMBI_CREATIVE_STANDARD}

${LIMBI_PURPOSE_AND_OUTCOME_STANDARD}

${LIMBI_SYMBOLIC_INTERPRETATION_STANDARD}

LANGUAGE AND FORMAT CONTRACT
- This prompt is written in English.
- Output MUST be valid JSON only (no markdown fences, no commentary outside JSON).
- JSON keys MUST remain in English exactly as in the REQUIRED OUTPUT SCHEMA below.
- ALL human-readable string values inside the JSON MUST be written in SPANISH.
- Do not mix languages inside string values.

USER-FACING LANGUAGE QUALITY RULES (CRITICAL — APPLIES TO THE ENTIRE VISIBLE FRAMEWORK)
- **Every** human-readable field the user will see must read as **natural Spanish**: semantic, strategic, and narrative — like a consultant explaining the challenge, **not** like a database dump.
- **Never** use snake_case, kebab-case technical tokens, camelCase variable names, internal slugs, technical tags, loose English keywords, telegraphic code-like fragments, or isolated internal labels in any string value.
- **Never** write isolated labels: always expand them into **strategic meaning** (what it implies, why it matters, how it guides communication).
- If a field states a **risk**, explain **why** it is a risk.
- If it states an **opportunity**, explain **what it enables** strategically.
- If it states a **conflict**, explain the **tension** behind it.
- If it states a **recommendation**, explain **what it should guide** in practice.
- If it states an **evidence gap**, explain **what is missing** and **why it matters** for credibility or narrative.
- For **conceptual_axes**, each axis must be a **human-readable strategic concept** with a clear title, meaning, and narrative use — never a slug or keyword list.
- Bad examples (forbidden anywhere in user-facing strings): cercanía_con_estatura, movilizacion_sin_presion, generic_tone, emotional_connection, low_evidence, institutional_language, content_opportunity_1, brand_storytelling.
- Good examples (style to follow): full sentences in Spanish that combine clarity and strategic depth, e.g. explaining closeness with authority, mobilization without pressure, clarity with distinction, or honest statements about weak evidence.

SOURCE OF TRUTH
- You receive a single JSON object (STRUCTURED INPUT below). It is a **curated subset** of the active Narrative Knowledge Master Document plus project identity. It does **not** include the full Master Document or full raw wizard dump.
- **wizard_stated_purpose_trace** (when non-empty) carries **wizard-origin** fields preserved in the Master Document’s **raw_inputs** — challenge explanation, transformation framing, why now, desired action, etc. Use it to keep the Marco aligned with what the user said they need communication **for**, without treating it as evidence of results.
- Do not claim you have seen the full Master Document. Do not reproduce internal technical dumps.

VISIBLE “PARA QUÉ” (STRATEGIC OUTCOME, NOT MOTIVATIONAL DECORATION)
- The visible framework must make the **strategic “para qué”** legible: **why this communication matters**, what **result or benefit** it should enable, and what **movement** (understanding, feeling, decision, action, perception) it targets — **concrete and human**, not grandiloquent purpose poetry.
- Reflect that intent across these fields (where applicable), so they read as one coherent story of **outcome**, not only **description**:
  - **executive_summary**
  - **strategic_diagnosis.expected_result**
  - **audience.desired_state** (and related audience fields)
  - **narrative_strategy.narrative_promise**
  - **message_architecture.main_message**
  - **strategic_recommendations**
  - **content_strategy_opportunities** (strategic roles and angles that serve the intended result — not generic channel filler)
- **Bad pattern**: motivational wallpaper or SaaS slogans with no situational anchor.
- **Good pattern**: clear statements of what becomes easier, clearer, or different for the audience and the brand when communication succeeds — grounded in the Master Document subset and **wizard_stated_purpose_trace** when present.

DEPTH AND HONESTY (CRITICAL)
- Be **explanatory and strategic**, not superficial.
- Describe **real conflicts** implied by the challenge and inputs — do not fabricate crises.
- **Risk map** and **evidence_gaps** must be **honest**: it is valid to state that evidence is thin, missing, or weak, or that certain claims cannot be supported yet.
- **Do not force invention** to fill fields. If information is insufficient, say so clearly in Spanish, for example:
  - "No hay evidencia suficiente registrada para sostener esta afirmación."
  - "La evidencia disponible todavía es débil y debe fortalecerse."
  - "Este punto debe tratarse como hipótesis estratégica, no como hecho comprobado."
- **Expected results** (e.g. in strategic_diagnosis.expected_result, audience.expected_action) must be phrased as **communication outcomes**, **perception shifts**, or **desired audience actions** — not fabricated metrics, KPIs, or invented numbers.

NON-NEGOTIABLES — NO INVENTION
- Do **not** invent quantitative results, statistics, market shares, or growth figures.
- Do **not** invent clients, awards, testimonials, case names, or proof of impact.
- **proof_points** (under message_architecture) must contain only points **clearly grounded** in **evidence_base** or in factual / documented elements of the Master Document subset you received. If there are not enough real proofs, include an **honest warning** in Spanish inside proof_points — **never** invent awards, logos of clients, or made-up results.

DIFFERENTIATION
- Clearly separate **risks** (risk_map), **strategic opportunities** (narrative_strategy + content_strategy_opportunities), and **recommendations** (strategic_recommendations).
- **content_strategy_opportunities** are **strategic territories and roles** — not captions, not final posts, not graphic taglines, not finished copy.

STRATEGIC NEGATIVE MATERIAL VS OUTWARD MESSAGE CORE (CRITICAL)
- **risk_map**, **conflict_map**, and **strategic_diagnosis** (including **communication_problem**) may name tensions, risks, objections, credibility concerns and evidence gaps honestly in Spanish — that is legitimate internal diagnosis.
- **executive_summary**, **narrative_strategy.narrative_promise**, **message_architecture.main_message**, **message_architecture.supporting_messages**, and angles inside **content_strategy_opportunities** must read as **forward-building strategic direction**: what the brand **stands for**, what it **invites** the audience toward, what **clarity or movement** it adds — **not** as a recycle of risk_map lines as the primary public-facing promise (e.g. do not let the narrative promise **lead** with “el riesgo de que…”, “el problema es que…”, or a feared misperception copied from diagnosis).
- Keep **diagnostic honesty** in diagnostic sections and **constructive / neutralizing posture** in promise, main message and executive summary; do not collapse them into a single negative headline.
- **content_strategy_opportunities** must not default to “crisis copy” or defensive venting unless the STRUCTURED INPUT clearly implies an explicit crisis or reputational posture the user is pursuing (rare).
- For any field that functions like **recommended public message** or **narrative promise**, apply the same discipline as in creative outputs:
${LIMBI_STRATEGIC_NEGATIVE_MATERIAL_STANDARD}

EDITORIAL PREFERENCE — TEMPLATE CONTRASTS (OUTWARD / MESSAGE-CORE FIELDS ONLY; NOT A HARD BAN)
- **strategic_diagnosis**, **risk_map**, **conflict_map** and similar diagnostic sections may use clear analytical language; stylistic pressure below applies mainly to **message-core** fields, not to honest diagnosis.
- In **executive_summary**, **narrative_strategy.narrative_promise**, **message_architecture.main_message**, **message_architecture.supporting_messages**, and **recommended_angles** / role lines inside **content_strategy_opportunities** that read like **headline copy**, **prefer** **direct, specific, mature Spanish**. **Treat** tired shells (“no es solo… es…”, “más que X, es Y”, “se trata de…” as filler, “conectando el futuro…”, “futuro del sector”, “colaboración auténtica”, “oportunidades de crecimiento real”, etc.) as **weak when generic** — not as absolute prohibitions. A contrast may remain if it is **original, necessary, and non-template**.
- This is **editorial guidance for the model**, not a validator: do not assume the framework is invalid because one phrase matches a pattern.
${LIMBI_BINARY_CLICHE_COPY_STANDARD}

SYMBOLISM AND VISIBILITY (consistent with LIMBI symbolic standard above)
- Rely on **conceptual territories**, **semantic_base**, and **production_rules**. Do not use raw symbolic wizard selections as visible metaphors unless project_identity or evidence_base proves literal relevance.

${
  input.revision_context
    ? `REVISION CONTEXT — STRATEGIC USE (STRUCTURED INPUT includes revision_context)
- **revision_context.revision_note** is NOT a comment to display, NOT a footnote, and NOT an extra user-facing field in your output JSON. It is a **strategic refinement instruction**: replan and rewrite the **entire** Strategic Narrative Framework so the intent of the note is woven through the strategic substance of the new Marco.
- **revision_context.prior_visible_framework** is the prior framework snapshot: use it to preserve strong, still-valid passages where they align with the Master Document subset and the refinement instruction; otherwise rewrite boldly.
${
  input.revision_context.carried_forward === true
    ? `
PERSISTENT GUIDANCE (revision_context.carried_forward === true)
- Treat **revision_context.revision_note** as the user's **latest active, persistent strategic refinement** for this project — not a one-off comment tied only to a prior regeneration.
- **Reconcile** that refinement with the **active Master Document** subset in STRUCTURED INPUT: the Master Document may have changed (new diagnosis, evidence, voice, rules). Integrate the user's line of refinement **across the new framework** while reflecting the updated strategic base.
- **Do not discard** the user's prior refinement merely because regeneration was triggered from the project center or because the Master Document version changed; carry its strategic intent forward unless it is **factually incompatible** with the new subset.
- If **revision_context.instruction** is present, follow it as an additional meta-instruction on how to apply the note relative to the Master Document.
- The refinement still **must not** override evidence discipline, **production_rules**, **guardrails**, or factual constraints; if the note conflicts with evidence_base or production_rules, preserve the base and adapt only what is safe.
`
    : ""
}

CROSS-CUTTING APPLICATION (when revision_context is present)
- Apply the refinement **across all major sections** of the output, wherever relevant, so the note changes **tone, emphasis, clarity, commercial or narrative angle, depth, hierarchy of ideas, and strategic posture** consistently — not in one corner only.
- Sections to consciously harmonize with the instruction (without inventing facts): **executive_summary**, **strategic_diagnosis**, **audience**, **conflict_map**, **risk_map**, **narrative_strategy**, **message_architecture**, **content_strategy_opportunities**, **success_signals**, **strategic_recommendations**, and **guardrails** (guardrails must remain protective; tighten or refocus them if the note asks for a sharper stance, but never hollow them out).

EXPLICIT CONTRACT FOR revision_note
- revision_context.revision_note is not a comment to display. It is a strategic refinement instruction. Apply it across the entire framework where relevant: tone, emphasis, clarity, narrative territory, message hierarchy, recommendations and guardrails. Do not create a separate field for the note. Do not quote it unless strategically necessary. Integrate its intent into the rewritten framework.
- Do not let the revision note override the Master Document subset embedded in STRUCTURED INPUT.
- Do not use the revision note to invent evidence, facts, metrics, or claims.
- If the revision note asks for something that conflicts with production_rules, evidence_base, or guardrails, preserve the strategic base and adapt only what is safe; drop or soften the conflicting part of the note.

SECONDARY vs PRIMARY
- Primary truth remains: strategic_base, audience_base, evidence_base, voice_base, semantic_base, production_rules, limbic_summary.literal_usage_limits, and factual honesty.
- The revision note is **secondary**: it steers emphasis and expression; it must never replace evidence discipline or invent proof.

OUTPUT SHAPE
- Output only the **complete** REQUIRED OUTPUT SCHEMA below (full new object). Never add root keys such as revision_note, revision_context, sugerencia, or any "user note" container. The user must see the refinement only through improved Spanish content in the prescribed fields.

`
    : ""
}REQUIRED OUTPUT SCHEMA (top-level keys must match; nested keys as shown)
{
  "executive_summary": "",
  "strategic_diagnosis": {
    "current_situation": "",
    "communication_problem": "",
    "strategic_opportunity": "",
    "expected_result": ""
  },
  "audience": {
    "who_we_need_to_move": "",
    "current_state": "",
    "desired_state": "",
    "expected_action": ""
  },
  "conflict_map": {
    "main_conflict": "",
    "perception_conflict": "",
    "emotional_conflict": "",
    "category_or_market_conflict": "",
    "internal_communication_conflict": ""
  },
  "risk_map": {
    "main_risks": [],
    "credibility_risks": [],
    "tone_risks": [],
    "evidence_gaps": [],
    "what_could_go_wrong": []
  },
  "narrative_strategy": {
    "narrative_promise": "",
    "communication_territory": "",
    "conceptual_axes": [
      {
        "axis_title": "",
        "strategic_meaning": "",
        "narrative_use": ""
      }
    ],
    "emotional_atmosphere": "",
    "voice_personality": ""
  },
  "message_architecture": {
    "main_message": "",
    "supporting_messages": [],
    "proof_points": [],
    "messages_to_avoid": []
  },
  "content_strategy_opportunities": {
    "strategic_content_roles": [],
    "content_opportunities": [],
    "recommended_angles": [],
    "not_final_content_warning": "Estas son oportunidades estratégicas, no piezas finales."
  },
  "success_signals": {
    "perception_indicators": [],
    "engagement_indicators": [],
    "conversion_or_action_indicators": [],
    "qualitative_signals": []
  },
  "strategic_recommendations": [],
  "guardrails": []
}

CONCEPTUAL AXES
- **conceptual_axes** is an array of objects. Each object must include **axis_title** (short human title in Spanish), **strategic_meaning** (what this axis means strategically), and **narrative_use** (how it should guide narrative and communication choices). Never use slug-like titles.

ARRAY RULES
- All other array fields: arrays of Spanish strings (full sentences or rich phrases). Arrays may be empty when honestly nothing can be claimed without invention.
- **content_opportunities** and related arrays: strategic angles and roles only — not final creative pieces.

STRUCTURED INPUT
${ctx}

GENERATION METADATA (for your reasoning only — do not output this block)
${JSON.stringify(input.generation_instructions, null, 2)}
`;
}
