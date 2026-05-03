import {
  LIMBI_BINARY_CLICHE_COPY_STANDARD,
  LIMBI_CREATIVE_STANDARD,
  LIMBI_PURPOSE_AND_OUTCOME_STANDARD,
  LIMBI_STRATEGIC_NEGATIVE_MATERIAL_STANDARD,
  LIMBI_SYMBOLIC_INTERPRETATION_STANDARD,
} from "@/lib/ai/limbi-creative-standard";
import type { ContentGenerationStructuredInput } from "@/lib/content/build-input";
import type { ContentGenerationValidationFeedback } from "@/lib/content/validate-content-json";

const PERSISTENT_EDITORIAL_GUIDANCE_EN = `
PERSISTENT EDITORIAL GUIDANCE (when content_generation_context.persistent_editorial_guidance is non-null)
- Treat that string as **active creative direction** for this project across **every** content_type you are generating now (short_pitch, captions, content_ideas, graphic_phrases): same weight for all — no type is exempt.
- It is **not** a comment to display, **not** optional decoration, **not** a separate output field.
- Apply it across **every** generated item where relevant: tone, angle, emphasis, clarity, emotional intensity, strategic intention and narrative usefulness.
- Do **not** quote the guidance verbatim unless strategically necessary. Integrate its intent into the Spanish strings of each item.
- It must **not** override the approved Strategic Narrative Framework (inside content_generation_context.from_approved_visible_framework), the active Master Document slices (from_master_document), production_rules, evidence_base, guardrails, what_to_avoid or GLOBAL_AI_RULES.
- If it conflicts with those sources, preserve the strategic base and adapt only what is safe; drop or soften the conflicting part of the guidance.

TERMINOLOGY / NAMING GUIDANCE (within persistent_editorial_guidance)
- If the guidance reads like a correction such as **"do not use X, use Y instead"**, **"no usar X, sino Y"**, **"no uses X, usa Y"**, **"avoid X, use Y"**, treat it as a **hard terminology guardrail** for this generation.
- **Never** use the rejected term or obvious morphological variants used to bypass the rule.
- Treat the **preferred** term as the **official naming** for that concept (platform, product, methodology, framework, category) for this generation.
- **Do not** merely avoid the rejected term: when generated content refers to that concept, the **preferred term must appear visibly** in the output (do not replace it with vague stand-ins such as "la plataforma", "el sistema", "la solución", "la metodología", "nuestra herramienta" **unless** the preferred term has **already** been clearly established earlier in the same generated set so the reader unambiguously links the generic phrase to that name).
- Apply the preferred term across **phrase**, **intention**, **visual_context**, **usage_note**, **strategic_intention**, **best_use**, **caption**, **tone**, **idea_title**, **idea_description**, etc., wherever the concept is in play.
- **graphic_phrases**: when the set describes Limbi, its differential method, or the named platform/product, the **preferred term must appear at least once** somewhere across **phrase**, **intention**, **usage_note**, or **visual_context** in the full batch (not necessarily every item, but the batch as a whole must not dodge the official name). If validation requires the exact name, put the **full preferred phrase verbatim** in **usage_note** or **intention** on at least one item (you may still keep **phrase** sharp and non-brochure).
- **short_pitch** (and other types when the copy names the product/method): when a terminology swap applies, use the **preferred** term visibly in **title**, **pitch**, **strategic_intention**, or **best_use** at least once in the batch — not only in graphic_phrases.
- If the user only asked for tonal guidance **without** a naming swap, interpret terminology rules narrowly (do not invent mandatory product names).
- Still respect the Master Document, approved Framework, evidence restrictions and GLOBAL_AI_RULES.
`.trim();

const GRAPHIC_PHRASES_RULES_EN = `
GRAPHIC_PHRASES (content_type: graphic_phrases) — SHARP VISUAL HEADLINES, NOT BROCHURE CLAIMS
- A graphic **phrase** must **not only sound nice**; it must carry a **clear point of view** — something this brand could **stand behind**, not neutral uplift.
- Each **phrase** must carry **clear tension or benefit** tied to the project’s strategic **“para qué”**: what the communication helps the audience **change, understand, decide or stop doing** — anchored in the framework + wizard purpose trace, not in vague inspiration.
- **Avoid generic pairings** such as “strategy and creativity”, “humanity and technology”, “emotion and intelligence”, “reason and heart”, unless the line adds a **distinctive, situation-specific angle** (who is stuck, what is at stake, what flips).
- **Avoid soft template claims** such as “humanized communication”, “real results”, “content with soul”, “innovative platform”, “strategic power”, “connects X and Y” — unless you **twist them into a sharper, non-generic idea** grounded in this project’s diagnosis or conflict.
- **Prefer** lines that express **tension**, a **before/after**, a **decision**, a **clear strategic belief or stake** drawn from your reading of conflict_map, narrative_strategy, message_architecture or audience friction — **without** restating internal **risk_map** or negative-perception lines as visible headline copy (see STRATEGIC NEGATIVE MATERIAL standard).
- The best lines should feel like something **Limbi (this project) believes**, not something **any AI / content / marketing SaaS** could paste on a homepage.
- **Do not** build lines by merely **combining two positive abstract words** (e.g. “humanidad + innovación”) with no situational bite.
- **Avoid generic visual metaphors** — gears, bridges, code lines with “human context”, clouds of ideas, sunrise horizons, hands joining cogs — **unless** the approved framework explicitly names or justifies that visual territory with project-specific substance.
- Each **phrase** must feel like a **sharp visual headline** or poster line rooted in this project's **conceptual territory** from the approved framework — not a soft SaaS slogan or generic AI-platform copy.
- **Avoid** generic AI-platform / transformation / inspiration language unless a **verbatim** line in from_approved_visible_framework forces that exact wording (extremely rare). Default-avoid patterns include (non-exhaustive): "transforma el conocimiento", "poder estratégico", "más allá de la automatización", "humanidad en cada línea de código", "comunicación que conecta", "no sólo transmite", "ruido digital", "claridad estratégica", "nuevo horizonte", "plataforma innovadora", "solución visualizada", "con un solo clic", "transforma el caos", "descubre [brand]", "comunicación con inteligencia y humanidad", "puente entre intelecto y emoción" — unless the framework text literally anchors them.
- **Avoid** leaning the whole **phrase** (or supporting fields) on tired **binary-contrast scaffolds** (“no es solo… es…”, “más que X, es Y”, etc.) **unless** the line clearly passes the **earned / specific / non-template** test in the EDITORIAL STANDARD block below — default toward **direct** Spanish.
- **Official naming** from persistent_editorial_guidance (e.g. a preferred platform name) is **allowed and encouraged** where relevant — it is **not** “generic innovation language”; use it when it names **this** product/method, not as a substitute for a point of view.
- **intention**, **visual_context** and **usage_note** must reinforce the same strategic bite as **phrase** (no generic filler that contradicts a sharp phrase).
- Do not lean on abstract pairings (reason vs emotion, mind vs heart) unless the approved framework explicitly builds that tension with project-specific substance.
`.trim();

const GRAPHIC_PHRASES_SELF_CHECK_EN = `
GRAPHIC_PHRASES — SELF-CHECK (apply silently before you lock each item; if weak, rewrite)
For **phrase** (and ensure **intention** / **visual_context** / **usage_note** do not soften into cliché):
- Could **any** AI / content / marketing SaaS say this **unchanged**? If yes → rewrite with project-specific tension or outcome.
- Does it express a **clear point of view** (belief, warning, before/after, or stake), not only a compliment?
- Does it connect to this project’s **“para qué”** (result, movement, perception shift) from the framework or wizard purpose trace?
- Does it avoid **generic inspiration** (two positive abstractions glued together)?
- Does it feel specific to **this** narrative territory — not interchangeable tech poetry?
- Does **phrase** (or **intention** / **usage_note**) lean on a **predictable** “no es / no solo / más que … es …” scaffold? If it reads **generic**, prefer rewriting into **direct, specific** Spanish; if the contrast is **truly earned**, you may keep it.
If any answer is weak, **rewrite** before output.
`.trim();

const GRAPHIC_PHRASES_RETRY_REINFORCEMENT_EN = `
RETRY — graphic_phrases (extra strict)
- Eliminate brochure-like fragments flagged by validation; rewrite every item from scratch.
- Apply persistent_editorial_guidance terminology rules if present: you must **use the preferred term** wherever the platform/method/product concept appears; do not dodge with generic paraphrases alone.
- **Mandatory:** include the **preferred term at least once** in a visible string (**phrase**, **intention**, **usage_note**, or **visual_context**). Use the **exact preferred wording** from the guidance (same words in order; punctuation may vary slightly). Putting it once in **usage_note** or **intention** is acceptable if the headline stays sharper.
- Re-run the **SELF-CHECK** on every item: no SaaS-generic pairings, no “humanized / soul / real results / strategy+creativity” fluff, no stock visual metaphors (gears, bridges, code+humanity, idea clouds, horizons) unless the framework literally supports them.
- If a line leaned on a **lazy** binary template, tighten it into **direct strategic Spanish**; if a contrast was **editorially necessary and specific**, you may retain it.
- Keep lines shorter, bolder, and anchored in framework tensions — not generic "innovation / trust / transformation" poetry.
`.trim();

const QUALITY_RULES_ES = [
  "Todo texto visible para el usuario debe estar en español natural (no inglés en los valores de string).",
  "No uses slugs, snake_case, nombres de variables, etiquetas internas ni jerga técnica visible en los textos que leerá el cliente.",
  "No inventes cifras, clientes, premios, testimonios, resultados ni impacto.",
  "No menciones símbolos o activos del wizard de forma literal salvo que el proyecto trate realmente de ese tema según identidad y evidencia.",
  "Si falta evidencia en el contexto, no simules pruebas ni datos; evita afirmaciones de prueba y centra la intención en percepción, claridad o invitación creíble.",
  "Deriva cada pieza de content_generation_context: from_master_document (identidad, bases estratégicas, evidencia, voz, semántica, producción, límbico, IQA, memoria si aplica), from_approved_visible_framework (marco aprobado completo en el bundle) y wizard_purpose_trace (reto declarado, transformación, acción deseada del cuestionario — intención, no evidencia); no contradigas production_rules, guardrails, evidence_base ni las reglas globales.",
  "Si content_generation_context.persistent_editorial_guidance tiene texto, respétalo como criterio creativo transversal en todos los tipos de contenido salvo conflicto con evidencia, production_rules, guardrails o GLOBAL_AI_RULES — en ese caso prevalecen las fuentes duras.",
  "Riesgos, amenazas, objeciones, tensiones negativas y percepciones problemáticas del marco o del documento maestro: úsalos solo como criterio interno (qué evitar, cómo neutralizar, tono); no los copies ni los encabeces en títulos, pitches, captions, ideas ni frases gráficas salvo brief explícito de crisis o reputación.",
  "Criterio editorial: desalentar fórmulas muy usadas («no es solo… es…», «más que… es…», «se trata de…», «conectando el futuro…», «futuro del sector», «colaboración auténtica», «oportunidades de crecimiento real», etc.) cuando suenen genéricas; prioriza concreción y oficio. No es regla bloqueante: una comparación puede quedarse si es precisa y original.",
].join("\n");

const PURPOSE_DRIVEN_CONTENT_EN = `
PURPOSE-DRIVEN CONTENT (“PARA QUÉ”, NOT ONLY “QUÉ”)
- Every generated item must **express or serve** the strategic **“para qué”** of this project: the **result, benefit, movement or transformation** the communication is meant to create — so the reader senses **why it matters**, not only **what the thing is**.
- Anchor that “para qué” in **content_generation_context.from_approved_visible_framework** (especially executive summary, diagnosis.expected_result, audience desired state / action, narrative_promise, main_message, content_strategy_opportunities) **and** in **content_generation_context.wizard_purpose_trace** when those objects carry text (declared challenge, transformation, why now, desired action — **intent, not proof**).
- **Do not** ship copy that only describes the product, service, or format with no link to **outcome or audience movement**. Prefer concrete human stakes over abstract uplift.
- **Bad pattern** (Spanish): “Limbi es una plataforma que organiza la comunicación.” (definition-only, no “para qué”).
- **Better pattern**: what becomes **different** for the brand or audience when this works — e.g. moving from scattered content to **intentional** communication — **without** melodrama or invented metrics.

BY content_type (layer on top of type-specific rules below)
- **short_pitch**: must explain **what** is being communicated, **for whom**, and **why it matters** (strategic “para qué”) — already required in SHORT_PITCH rules; do not weaken into pure description. **Prefer** not to let **title** or **pitch** **hinge** on a generic “no es / no solo / más que … es …” scaffold; use a contrast **only** if it is sharp, specific, and non-interchangeable (see EDITORIAL STANDARD block).
- **captions**: each caption needs a **reason to connect** (stakes, benefit, tension, or invitation tied to the framework’s outcome) — not a neutral catalogue of what the project is. **Prefer** one **clear, specific** line over a whole caption built as a **stock** “más que X, Y” tagline.
- **content_ideas**: each idea must state **what strategic result** it could help produce (clarity, trust, reconsideration, action, perception shift, etc.) — not only a format or topic title. **Prefer** that **idea_title** / **idea_description** not be **mostly** boilerplate “no es Y, es Z” / “no es solo… es…”; direct framing is the default.
- **graphic_phrases**: lines must imply **benefit, tension, or movement** aligned with the “para qué”, not decorative inspiration (see GRAPHIC_PHRASES rules). **Default** away from **lazy** binary-contrast gimmicks; keep a contrast only if it **earns** its place (see EDITORIAL STANDARD block).
`.trim();

const DERIVATION_RULES_EN = `
STRATEGIC DERIVATION (NON-NEGOTIABLE)
- The generated content MUST clearly derive from **content_generation_context.from_approved_visible_framework** (executive summary, diagnosis, audience, conflict map, risk map, narrative strategy, message architecture, content_strategy_opportunities, success_signals, strategic_recommendations, guardrails, what_to_avoid) AND from **content_generation_context.from_master_document** (project_identity, strategic_base, audience_base, evidence_base, voice_base, semantic_base, production_rules, limbic_base, input_quality_assessment, memory when present), AND from **content_generation_context.wizard_purpose_trace** when it contains user-declared purpose fields (challenge, transformation, desired action, etc.).
- You MUST actively use: project identity, communication territory, central tensions / conflicts, narrative promise, audience definition, message architecture (main and supporting angles where useful), guardrails, what_to_avoid, evidence discipline, voice and semantic signals — woven into the prose as **constructive public meaning**, not as internal labels.
- **risk_map** and other **negative diagnostic strings**: use them to **calibrate** what to avoid, how sharp or soft to be, and what positive or neutralizing story to tell — **never** as literal quoted objections, threats, or “perception risk” sentences inside titles, pitches, captions, ideas, or graphic phrases (unless explicit crisis/reputation brief per STRATEGIC NEGATIVE MATERIAL standard).
- Do NOT produce generic marketing language, empty hype, or copy that could apply unchanged to any other brand.
- Do NOT use placeholder or brochure phrases such as (non-exhaustive): "nuestra solución", "nuestro servicio", "descubre la diferencia", "te ayudamos a crecer", "tu compañero de confianza", "simplicidad que empodera", "transforma la manera", "valor añadido", "soluciones innovadoras" — unless the EXACT wording is explicitly justified by a verbatim quote inside from_approved_visible_framework (extremely rare). Default: never use them.
- Avoid generic brochure language, empty motivational slogans, and abstract promises with no situational context from this project.
- **Treat** overused **binary-contrast taglines** (“no es Y, es Z”, “no solo… es…”, “más que X, es Y”) as **weak when they are the backbone** of an item; prefer **specific** craft unless the line is clearly **non-generic** (see EDITORIAL STANDARD block).
`.trim();

const USER_FACING_QUALITY_EN = `
USER-FACING CONTENT QUALITY RULES
- Every generated item must be specific to this project (name/descriptor, challenge, audience and framework tensions must show up in meaning, not as keyword stuffing).
- Every item must be semantically meaningful and narratively useful for decision-makers or communicators of THIS brand — and must **signal the strategic “para qué”** (why this communication exists / what should change) in substance, not as empty “purpose” jargon.
- Do not write generic slogans, brochure filler, or abstract promises without concrete strategic context drawn from the sources.
- Do not invent facts, metrics, clients, awards, testimonials or impact.
- If evidence is weak, avoid proof claims; focus on perception, clarity, invitation or strategic repositioning grounded in the framework.
- Use natural Spanish.
- Do not use snake_case, slugs or internal labels in user-facing strings.
- Each item must articulate a strategic intention clearly linked to the approved framework (what perception, decision or emotion it seeks to move).
- **Never** surface internal risk / threat / objection language as the **visible** hook or lead; express the **intended public story** that neutralizes those concerns without teaching the reader the negative frame first.
- **Prefer** **direct, mature** Spanish over **predictable** binary-contrast copy (“X no es Y, es Z”, “no es solo… es…”, “más que X, es Y”, “no hacemos X, hacemos Y”). A contrast may remain **only** if it is **original, necessary, and non-template** for this project (see EDITORIAL STANDARD block — guidance, not a hard filter).
`.trim();

const SHORT_PITCH_MENTAL_MODEL_EN = `
MANDATORY MENTAL MODEL FOR EVERY short_pitch ITEM
"This is not a slogan. This is a strategic pitch. It must explain what is being moved for the audience and the narrative promise in concrete, public-ready language — informed by internal diagnosis and risks, but **without** repeating negative-perception or threat lines as the visible story."
Write as if briefing a leadership team — not as if writing a billboard.
`.trim();

const SHORT_PITCH_RULES_EN = `
SHORT_PITCH (content_type: short_pitch) — STRATEGIC PITCH, NOT SLOGAN OR ASPIRATIONAL AD COPY

${SHORT_PITCH_MENTAL_MODEL_EN}

TITLE ("title")
- Must function as a SPECIFIC strategic headline (what situation or move this pitch addresses), NOT an empty slogan or motivational poster line.
- FORBIDDEN title patterns (do not mimic this vibe): "Despierta el valor oculto", "Claridad transformadora", "Impulso sin presiones", "Tu camino al éxito", "Conecta con lo que importa", or any similar abstract two–four word "hero" headline with no situational anchor.
- Prefer plain, concrete framing drawn from **constructive** strategic territory in **from_approved_visible_framework** (audience, promise, territory, message architecture) — still in natural Spanish, not jargon labels. **Do not** headline with internal **risk** or **feared perception** wording (e.g. leading with how the brand might be misread).

PITCH ("pitch") — MUST ANSWER IN PLAIN LANGUAGE (can be one tight paragraph of a few short sentences)
1) What is being communicated (substance from message_architecture / narrative promise / territory — not hype).
2) For whom (audience from snapshot / identity — who must hear this).
3) What strategic **move or clarity** this communication delivers — informed by diagnosis, conflict_map, risk_map and audience friction **internally**, but **without** repeating risks, threats, or negative-perception lines as literal public copy (no “el riesgo es…”, “el problema es que…”, “podrían vernos como…” unless explicit crisis/reputation brief).
4) What perception or action change it seeks (from narrative promise / expected action — concrete, forward-building, not "inspire" or "empower" in the abstract).

The pitch must read like a brief strategic explanation: clear, human, usable — NOT like an inspirational advertisement, NOT like a tagline stack, NOT like generic "transform / clarity / trust / energy" poetry.

PROVISIONAL OR WEAK PROJECT NAME
- If name_or_descriptor is provisional or vague, do NOT pad with generic marketing. Anchor instead in challenge_type, main_challenge, audience, tensions and narrative promise from the framework so the reader still knows WHICH situation this is.

BANNED VOCABULARY (default: never use these strings; do not "ground" them with fluff — if they are not literally required by a verbatim line in the framework snapshot, omit entirely)
- valor auténtico, guía confiable, transforma la manera, desafíos en oportunidades, beneficios tangibles, liderazgo transformacional, solución integral, experiencia memorable, conexión emocional, propósito de marca, propuesta diferenciadora
- plus earlier brochure list in DERIVATION_RULES

EDITORIAL PREFERENCE — BINARY / TEMPLATE PHRASES (short_pitch — **title**, **pitch**, **strategic_intention**, **best_use**)
- **Avoid by default** (treat as **signals of weak craft** when generic) structures such as: “no solo…, sino…”, “no es solo…, es…”, “X no es Y, es Z”, “X es más que Y, es Z”, “más que…, es…”, “más allá de…, es…”, “se trata de…” (vague), “conectando el futuro de…”, “futuro del sector”, “colaboración auténtica”, “oportunidades de crecimiento real”, “Más que un evento, es una experiencia”, “Más que comunicar, conectamos”, etc.
- **Prefer** stating **substance** (quién, qué convoca, qué cambia, qué oportunidad) in **direct** Spanish. **Do not** treat this list as an absolute ban: a comparison may **survive** if it is **really original**, **clarifies a strategic tension**, **does not sound like stock copy**, is **not the only trick** holding the text up, and passes a **swap-the-brand-name** test.
- **This is editorial quality guidance for the model, not a technical validator** — output must not be assumed invalid solely because one phrase matches a pattern above.

FIELD REMINDERS (Spanish values; English keys)
- "strategic_intention": which perception, decision or emotion moves — tied explicitly to framework tensions/audience (no abstract self-help).
- "best_use": concrete deployment (stakeholder, moment, channel class) — not "anywhere" or "all channels".
`.trim();

const SHORT_PITCH_RETRY_REINFORCEMENT_EN = `
RETRY — short_pitch (extra strict on this attempt)
- No slogans, no brochure language, no motivational filler, no generic transformation language.
- **Tighten** **title** and **pitch**: if they lean on **lazy** “no es / no solo / más que … es …” or other **template** phrasing, prefer **direct, specific** strategic Spanish — keep a contrast **only** if it clearly **earns** its place per the EDITORIAL STANDARD block.
- Explain the communication challenge, audience movement and narrative promise in concrete language from content_generation_context.from_approved_visible_framework (diagnosis, conflicts, audience, message_architecture, narrative_strategy).
- Rewrite every field from scratch; do not paraphrase the rejected wording.
`.trim();

export function buildContentGenerationValidationFeedbackBlock(
  feedback: ContentGenerationValidationFeedback,
): string {
  const offending =
    feedback.offending_value !== undefined && feedback.offending_value !== ""
      ? feedback.offending_value
      : "(not applicable or entire fragment omitted)";

  return `
PREVIOUS ATTEMPT FAILED QUALITY VALIDATION

The previous output was rejected because:
- Public summary: ${feedback.message}
- Technical: ${feedback.internal_reason}

Offending text (if applicable):
${offending}

Rule code: ${feedback.offending_rule}

You must regenerate the full JSON from scratch.
Do not reuse the rejected phrase or any near-duplicate of it.
${
  feedback.offending_rule === "rejected_editorial_term"
    ? `
TERMINOLOGY (retry — mandatory)
- persistent_editorial_guidance required dropping a **rejected** term and using a **preferred** term when the concept appears. The previous JSON still contained the rejected wording. Remove it completely and surface the preferred wording wherever that concept is communicated.
`
    : ""
}
${
  feedback.offending_rule === "missing_preferred_editorial_term"
    ? `
TERMINOLOGY (retry — mandatory)
- You avoided the **rejected** term, but you **failed to use the preferred term** from persistent_editorial_guidance where the concept (platform, methodology, product, category) is clearly in play.
- Regenerate the full JSON from scratch. **You must include the preferred term at least once** in the visible strings of the batch (one clear occurrence is enough):
  - **graphic_phrases**: **phrase**, **intention**, **usage_note**, or **visual_context**
  - **short_pitch**: **title**, **pitch**, **strategic_intention**, or **best_use**
  - **captions** / **content_ideas**: any of that type’s string fields
- Use the **exact preferred wording** from persistent_editorial_guidance (same words in order). If a headline must stay abstract, still place the **full preferred name** once in **pitch**, **strategic_intention**, or **best_use** (short_pitch) or **usage_note** / **intention** (graphic_phrases) so the batch names the official product/platform/method.
- Do not substitute vague placeholders ("la plataforma", "el sistema", "la solución") unless the preferred name has already been established clearly in the same output so the reader ties them together.
`
    : ""
}
${
  feedback.offending_rule === "generic_phrase"
    ? `
GENERIC PHRASE (retry — rewrite the idea, not the spelling)
- The validator flagged a **brochure-like or overused fragment** in the offending text above. **Do not** fix this by swapping one buzzword for a near-synonym.
- **Rewrite the whole sentence or item** so the same strategic meaning is expressed with **more specific, framework-grounded Spanish** (concrete diagnosis, audience tension, or outcome).
- Example direction: instead of recycling a vague “category villain” label, name what is actually wrong (e.g. tools without narrative judgment, content without direction, automation without intent) using language justified by the approved framework.
`
    : ""
}
Make the content more specific to:
- content_generation_context.from_approved_visible_framework (executive summary, diagnosis, audience, conflicts, risks, narrative strategy, message architecture, success_signals, strategic_recommendations)
- content_generation_context.from_master_document (evidence_base, strategic_base, audience_base, voice_base, semantic_base)
- content_generation_context.wizard_purpose_trace (declared challenge, transformation, audience movement — use for “para qué”, not as proof)
- central tension and audience movement
- message architecture and guardrails
- evidence limitations (do not invent proof)

`.trim();
}

const USER_NOTE_CONTRACT_EN =
  "If user_note is present, treat it ONLY as secondary creative orientation. " +
  "It must NOT override the active Master Document, the approved Strategic Framework, production_rules, guardrails, evidence_base, or GLOBAL_AI_RULES. " +
  "If user_note conflicts with those sources, ignore the conflicting part of user_note.";

export function buildContentGenerationOutputShapeBlock(
  input: ContentGenerationStructuredInput,
): string {
  const n = input.quantity;
  const ct = input.content_type;
  const base = `Return ONLY valid JSON with this exact top-level shape:
{
  "content_type": "${ct}",
  "items": [ /* exactly ${String(n)} objects */ ]
}`;

  switch (ct) {
    case "short_pitch":
      return `${base}
Each item MUST have these keys (all string values, Spanish prose, non-empty after trim):
- "title"
- "pitch"
- "strategic_intention"
- "best_use"`;
    case "captions":
      return `${base}
Each item MUST have:
- "caption"
- "tone"
- "strategic_intention"
- "suggested_channel"`;
    case "content_ideas":
      return `${base}
Each item MUST have:
- "idea_title"
- "idea_description"
- "strategic_role"
- "possible_format"
- "why_it_works"`;
    case "graphic_phrases":
      return `${base}
Each item MUST have:
- "phrase"
- "intention"
- "visual_context"
- "usage_note"`;
    default: {
      const _exhaustive: never = ct;
      return _exhaustive;
    }
  }
}

/**
 * Prompt en inglés; strings humanos en la salida JSON deben ir en español.
 * @param validationFeedback Si existe, se añade bloque de corrección tras un intento fallido.
 */
export function buildContentGenerationPrompt(
  input: ContentGenerationStructuredInput,
  validationFeedback?: ContentGenerationValidationFeedback,
): string {
  const ctx = JSON.stringify(
    {
      prompt_version: input.prompt_version,
      content_type: input.content_type,
      quantity: input.quantity,
      user_note: input.user_note,
      master_document: input.master_document,
      visible_framework: input.visible_framework,
      content_generation_context: input.content_generation_context,
      generation_instructions: input.generation_instructions,
    },
    null,
    2,
  );

  const hasPersistentGuidance =
    input.content_generation_context.persistent_editorial_guidance !== null &&
    String(input.content_generation_context.persistent_editorial_guidance).trim()
      .length > 0;

  const userNoteSection =
    input.user_note && input.user_note.trim().length > 0
      ? `\nUSER NOTE (secondary only — see contract above)\n${input.user_note.trim()}\n`
      : "";

  const shortPitchExtra =
    input.content_type === "short_pitch" ? `\n${SHORT_PITCH_RULES_EN}\n` : "";

  const graphicPhrasesExtra =
    input.content_type === "graphic_phrases"
      ? `\n${GRAPHIC_PHRASES_RULES_EN}\n\n${GRAPHIC_PHRASES_SELF_CHECK_EN}\n`
      : "";

  const feedbackBlock = validationFeedback
    ? `\n${buildContentGenerationValidationFeedbackBlock(validationFeedback)}\n`
    : "";

  const shortPitchRetryExtra =
    validationFeedback && input.content_type === "short_pitch"
      ? `\n${SHORT_PITCH_RETRY_REINFORCEMENT_EN}\n`
      : "";

  const graphicPhrasesRetryExtra =
    validationFeedback && input.content_type === "graphic_phrases"
      ? `\n${GRAPHIC_PHRASES_RETRY_REINFORCEMENT_EN}\n`
      : "";

  return `${LIMBI_CREATIVE_STANDARD}

${LIMBI_PURPOSE_AND_OUTCOME_STANDARD}

${LIMBI_SYMBOLIC_INTERPRETATION_STANDARD}

${LIMBI_STRATEGIC_NEGATIVE_MATERIAL_STANDARD}

${LIMBI_BINARY_CLICHE_COPY_STANDARD}

LANGUAGE AND FORMAT CONTRACT
- This instruction prompt is in English.
- Output MUST be valid JSON only (no markdown fences).
- JSON keys MUST remain in English exactly as specified (snake_case).
- ALL human-readable string values inside "items" MUST be natural Spanish for end readers — not English, not technical labels, not internal codenames.

${USER_NOTE_CONTRACT_EN}

GLOBAL AI RULES (apply strictly)
${input.global_ai_rules}

${hasPersistentGuidance ? `${PERSISTENT_EDITORIAL_GUIDANCE_EN}\n` : ""}
${PURPOSE_DRIVEN_CONTENT_EN}

${DERIVATION_RULES_EN}

${USER_FACING_QUALITY_EN}

QUALITY AND STYLE (Spanish output strings)
${QUALITY_RULES_ES}

STRUCTURED CONTEXT (read carefully; do not fabricate beyond these sources)
- Primary narrative bundle: **content_generation_context** (from_master_document + from_approved_visible_framework + wizard_purpose_trace + persistent_editorial_guidance when present). Use the full bundle for every item; do not treat unused sections as optional decoration.
${ctx}
${userNoteSection}
${feedbackBlock}
${shortPitchRetryExtra}
${graphicPhrasesRetryExtra}
TASK
- Generate exactly ${String(input.quantity)} content pieces of type "${input.content_type}".
- Anchor every piece in **content_generation_context** (master + approved framework + wizard purpose trace + persistent editorial guidance when present). Generic marketing that ignores those sources is a failure.
- Use negative strategic material (risks, objections, bad perceptions) **only as silent intelligence**; every visible string must read as **public-ready** constructive or neutralizing narrative — not as a dump of internal fears.
- The **EDITORIAL STANDARD** block on template / binary phrases is **craft guidance for you** — **not** a hard technical rule: valid JSON must not be treated as failed **only** because a line matches a listed pattern.
- Respect guardrails and what_to_avoid inside from_approved_visible_framework; do not contradict production_rules in from_master_document.
${shortPitchExtra}
${graphicPhrasesExtra}
${buildContentGenerationOutputShapeBlock(input)}

FINAL CHECK
- "items" array length MUST equal ${String(input.quantity)} — not more, not fewer.
- "content_type" at root MUST be exactly "${input.content_type}".
- Re-read each item: if it could apply unchanged to another unrelated brand, rewrite mentally before output — it must be project-specific.
- Re-read each item: if it only describes **what** the project is or does with no trace of **why this communication matters** (strategic “para qué” / outcome / movement), rewrite before output.
- Optional editorial pass: if a line **hinges** on a **predictable** “no es / no solo / más que … es …” scaffold or other **template** phrase from the EDITORIAL STANDARD block and reads **generic**, prefer a **more direct** rewrite; **do not** treat this as a mandatory rejection rule.
`;
}
