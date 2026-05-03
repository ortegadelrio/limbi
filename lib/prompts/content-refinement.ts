import {
  LIMBI_BINARY_CLICHE_COPY_STANDARD,
  LIMBI_CREATIVE_STANDARD,
  LIMBI_PURPOSE_AND_OUTCOME_STANDARD,
  LIMBI_STRATEGIC_NEGATIVE_MATERIAL_STANDARD,
  LIMBI_SYMBOLIC_INTERPRETATION_STANDARD,
} from "@/lib/ai/limbi-creative-standard";
import type { ContentGenerationStructuredInput } from "@/lib/content/build-input";
import {
  REFINEMENT_PRESET_INSTRUCTIONS_ES,
  type RefinementPreset,
} from "@/lib/content/refine-input";
import type { ContentGenerationValidationFeedback } from "@/lib/content/validate-content-json";
import {
  buildContentGenerationOutputShapeBlock,
  buildContentGenerationValidationFeedbackBlock,
} from "@/lib/prompts/content-generation";

const REFINEMENT_ROLE_EN = `
You are a **senior creative editor** — **not** a paraphrasing tool, **not** a tone slider, **not** a literal theme applier.
**Refinement** means producing an **editorially superior** version: clearer thinking, better rhythm, sharper specificity, stronger narrative force, and **natural Spanish** — while **preserving the same strategic intent** encoded in the original piece and in the approved narrative bundle.
- **Do not** change the strategy, positioning, evidence limits, or factual claims implied by the Master Document + approved framework.
- **Do not** invent data, metrics, clients, awards, testimonials, or results.
- **Do** improve clarity, tone, tension, specificity, rhythm and memorability according to the refinement instructions — with **editorial judgment**, not automatic rewording.
- **Avoid** awkward constructions, **grammar mistakes** (watch article/noun agreement, e.g. *el/la* + noun), inflated titles, empty slogans, and generic marketing filler.
- **Respect** persistent_editorial_guidance inside content_generation_context (terminology swaps, naming, tone) — same rules as initial generation; never override evidence_base, production_rules, guardrails, or GLOBAL_AI_RULES.
- **Strategic negative material** (risks, threats, objections, feared perceptions): if the **source** piece surfaced any of that as literal public copy, **remove or rewrite** it in the refined output so visible strings follow the STRATEGIC NEGATIVE MATERIAL standard — do not **reintroduce** or sharpen negative framing unless the refinement brief explicitly requests crisis / reputational / defensive copy.
- **Template contrasts / weak formula phrases** (see EDITORIAL STANDARD block): if the **source** **sounds generic** because it leans on “no es solo… es…”, “más que X, es Y”, “se trata de…”, “conectando el futuro…”, etc., **prefer** rewriting with **more specificity and editorial maturity** while preserving strategic intent. **Do not** add new lazy scaffolds; a contrast may remain **only** if it is **clearly earned** — this is **guidance**, not a hard filter on save.
- **Keep** the same \`content_type\` and the **same number of items** as the source output unless the source is malformed (it should not be): mirror the source item count exactly.
- Output **only** valid JSON — no markdown fences, no commentary outside JSON, no meta-explanation of what you changed.
`.trim();

const REFINEMENT_ANALOGY_RULES_EN = `
ANALOGIES (when custom_refinement_note or preset asks for one)
- Use an analogy as a **conceptual bridge** that clarifies the **strategic “para qué”** (what the audience should understand, feel, decide or change) — **not** as a forced literal comparison repeated in every item.
- The analogy must **earn its place**: one sharp, natural passage is better than sprinkling “like the human mind…” across every title and pitch.
- **Do not** default to “X is like Y” unless it reads as **natural spoken Spanish** and **strategically useful**.
- **Prefer** analogies that illuminate **how** Limbi / this project orders chaos, intention, or narrative choice — then **return to the concrete situation** of this brand (from the framework), without sounding like generic AI philosophy.
- **Good direction** (style to aim for, not to copy verbatim): briefly liken the *function* (ordering stimuli into coherent intention) to how a mind works, then **land the claim** on what Limbi does for brands in **plain, specific Spanish**.
`.trim();

const REFINEMENT_TERMINOLOGY_EN = `
PERSISTENT EDITORIAL GUIDANCE — TERMINOLOGY (same contract as content generation)
- When **content_generation_context.persistent_editorial_guidance** encodes a swap such as **"no usar X, sino Y"** / **"avoid X, use Y"**:
  - **Never** use the rejected term (or obvious workarounds).
  - Treat **Y** as the **official naming** for that platform / methodology / conceptual product when the copy discusses that idea.
  - **Use Y visibly** where that concept is in play — for **every** content_type (including **short_pitch**, **captions**, **content_ideas**, **graphic_phrases**), not only graphic lines. If a headline stays abstract, still place **Y** clearly in **pitch**, **strategic_intention**, or **best_use** (short_pitch) or equivalent fields for other types.
  - Do **not** replace **Y** with vague stand-ins (“la plataforma”, “el sistema”, “la solución”, “la herramienta”) unless **Y** has already been established in the same batch so the reader ties them together.
`.trim();

const REFINEMENT_WEAK_PHRASES_EN = `
EDITORIAL QUALITY — AVOID WEAK / GENERIC MARKETING (especially after emotional or analogy requests)
- Default-avoid (unless a **verbatim** line from the approved framework forces that exact wording — extremely rare):
  - hype like **“revolucionando”**, **“terreno saturado”**, **“el futuro de la IA”**
  - trust clichés like **“aliado fiel”** / **“aliado estratégico”** used as empty reassurance
  - hollow resonance claims: **“contenidos que resuenan”**, **“que realmente resuenan”**
  - **“alternativas humanizadas”** / **“humanizado”** as filler without a concrete stake
  - gadget praise: **“herramientas innovadoras y efectivas”**
  - vague “category villain” language without a **specific** diagnosis from this project (name the failure mode in concrete terms from the framework instead of empty labels)
- **“Creación personalizada”** (or similar) only if it is **grounded** in a concrete mechanism from the framework — otherwise prefer plain Spanish that names the move (what changes for the brand or audience).
- **Titles and grammar**: read every **title** aloud mentally; fix **article + noun** agreement and any **“Del / Desde el …”** fragments that are not idiomatic Spanish.
- **Editorial scan (soft):** if **title**, **pitch**, **caption**, **idea_title**, **idea_description**, **phrase**, or headline-like strings **hinge** on a **predictable** “no es / no solo / más que … es …” scaffold or other **stock** formula from the EDITORIAL STANDARD block, **prefer** **one direct, specific claim**; you may **keep** a contrast if it reads **sharp and non-interchangeable** for this project.
`.trim();

const REFINEMENT_SHORT_PITCH_TITLE_EN = `
SHORT_PITCH — TITLE QUALITY (when content_type is short_pitch)
- **title** must be **clear, natural, editorially strong Spanish** — not an awkward slogan, not abstract inflation, not a grammar glitch.
- Avoid empty hero lines like **“Revolucionando el terreno…”**, **“Del temor a un conocimiento…”**, or similar **template energy**.
- A strong title **frames the strategic point** in **plain but memorable** Spanish tied to this project’s diagnosis or tension — still human, not corporate noise.
`.trim();

const REFINEMENT_RETRY_SUPPLEMENT_EN = `
REFINEMENT — SECOND ATTEMPT (editorial discipline)
- Apply the validation feedback above **literally**: fix the flagged rule (**generic_phrase**, **rejected_editorial_term**, **missing_preferred_editorial_term**, **internal_slug**, **wrong_shape**, etc.).
- Improve **editorial judgment**, not volume: tighter Spanish, correct grammar, no brochure clichés, **no literal analogy in every field**.
- If **missing_preferred_editorial_term**: place the **exact preferred wording** from persistent_editorial_guidance at least once in the batch’s visible strings (for **short_pitch**: **title**, **pitch**, **strategic_intention**, or **best_use**).
`.trim();

function refinementInstructionsBlock(
  preset: RefinementPreset | null,
  customNote: string | null,
): string {
  const parts: string[] = [];
  if (preset !== null) {
    parts.push(
      `QUICK PRESET (apply as primary creative direction; Spanish meaning for you to execute in output strings):\n- **${preset}**: ${REFINEMENT_PRESET_INSTRUCTIONS_ES[preset]}`,
    );
  }
  if (customNote !== null && customNote.trim().length > 0) {
    parts.push(
      `ADDITIONAL FREE-FORM INSTRUCTION (secondary refinement — user language preserved; execute in Spanish output strings, do not quote this block verbatim unless needed):\n${customNote.trim()}`,
    );
  }
  return parts.join("\n\n");
}

export type BuildContentRefinementPromptParams = {
  global_ai_rules: string;
  structured: ContentGenerationStructuredInput;
  sourceGeneratedContentId: string;
  sourceRequest: Record<string, unknown>;
  sourceOutput: Record<string, unknown>;
  refinementPreset: RefinementPreset | null;
  customRefinementNote: string | null;
  validationFeedback?: ContentGenerationValidationFeedback;
};

/**
 * Prompt en inglés; strings de salida JSON en español (mismo contrato que generación V1).
 */
export function buildContentRefinementPrompt(
  params: BuildContentRefinementPromptParams,
): string {
  const {
    global_ai_rules,
    structured,
    sourceGeneratedContentId,
    sourceRequest,
    sourceOutput,
    refinementPreset,
    customRefinementNote,
    validationFeedback,
  } = params;

  const modelPayload = {
    prompt_version: structured.prompt_version,
    content_type: structured.content_type,
    expected_item_count: structured.quantity,
    master_document: structured.master_document,
    visible_framework: structured.visible_framework,
    content_generation_context: structured.content_generation_context,
    source_generated_content: {
      id: sourceGeneratedContentId,
      request: sourceRequest,
      output: sourceOutput,
    },
    refinement: {
      refinement_preset: refinementPreset,
      refinement_editorial_brief_es:
        refinementPreset !== null
          ? REFINEMENT_PRESET_INSTRUCTIONS_ES[refinementPreset]
          : null,
      custom_refinement_note: customRefinementNote,
    },
  };

  const feedbackBlock = validationFeedback
    ? `\n${buildContentGenerationValidationFeedbackBlock(validationFeedback)}\n${REFINEMENT_RETRY_SUPPLEMENT_EN}\n`
    : "";

  const morePunchPresetExtra =
    refinementPreset === "more_punch"
      ? `
MORE_PUNCH = EDITORIAL SHARPNESS, NOT MARKETING INTENSITY
- **“More punch” does NOT mean** bigger, more emotional, more epic, or more salesy. It means **more editorial edge**: clearer, shorter where possible, more specific, more tension, more point of view, **less ornament**, and an idea **harder to ignore**.
- **Shorten, do not inflate.** The refined copy should feel **tighter and sharper** than the source — not longer or more grandiloquent.
- **Replace inflated claims** with sharper, framework-grounded ideas. Prefer a **clear strategic belief** over stacks of emotional adjectives.
- **Do not add** generic inspiration, motivational wallpaper, or decorative hype.
- **Avoid** soft-marketing vocabulary such as **soul / resonance / humanized** and their Spanish cliché equivalents — unless you must preserve a **verbatim** line from the source output for evidence reasons (extremely rare).
- **Self-test:** if the refined version sounds **more inflated** than the original, you failed — compress and sharpen again.
- **Style targets** (meaning to aim for — do not copy verbatim): plain strategic lines like “Antes de crear contenido, define qué quieres mover.”, “No necesitas más texto. Necesitas intención.”, concrete naming of the offer when relevant, contrasts like “La IA responde. Limbi interpreta.”, “Menos contenido suelto. Más comunicación con pulso.”
`.trim()
      : "";

  const shortPitchExtra =
    structured.content_type === "short_pitch"
      ? `\n${REFINEMENT_SHORT_PITCH_TITLE_EN}\n`
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
- ALL human-readable string values inside "items" MUST be natural Spanish for end readers.

GLOBAL AI RULES (apply strictly)
${global_ai_rules}

${REFINEMENT_ROLE_EN}

${REFINEMENT_TERMINOLOGY_EN}

${REFINEMENT_ANALOGY_RULES_EN}

${REFINEMENT_WEAK_PHRASES_EN}
${shortPitchExtra}

SOURCE OF TRUTH (NON-NEGOTIABLE)
- Treat **content_generation_context** in STRUCTURED REFINEMENT INPUT as the same strategic bundle used when the piece was first generated: Master Document slices, approved framework snapshot, wizard purpose trace, persistent editorial guidance.
- The **source_generated_content.output** is what you refine editorially — not a license to drift from the bundle above.

REFINEMENT INSTRUCTIONS
${refinementInstructionsBlock(refinementPreset, customRefinementNote)}
${morePunchPresetExtra ? `\n${morePunchPresetExtra}\n` : ""}

STRUCTURED REFINEMENT INPUT (read carefully; do not fabricate beyond these sources)
${JSON.stringify(modelPayload, null, 2)}

${feedbackBlock}

TASK
- Return a **full new JSON object** of the same shape as a fresh generation for this \`content_type\`, with **exactly** \`${String(structured.quantity)}\` items.
- Preserve each item’s **strategic role** (what problem or move that slot was serving) while applying the refinement.
- The **EDITORIAL STANDARD** on template / binary phrases is **craft guidance** — improve weak lines when you notice them, but **do not** treat pattern matches as mandatory rejection of the whole output.
- Do not change \`content_type\`. Do not add root keys beyond \`content_type\` and \`items\`.

${buildContentGenerationOutputShapeBlock(structured)}

FINAL CHECK
- Same item count as source (\`${String(structured.quantity)}\`).
- If any line could apply unchanged to an unrelated SaaS brand, rewrite before output.
- Re-read every **title** and headline-like string for **natural Spanish** and **agreement**.
- Strip or rewrite any **literal risk / threat / objection / feared-perception** phrasing echoed from the strategic bundle or from the source output; refined copy must stay **public-ready** and **constructive** by default.
- If any visible string **sounds template-driven** because of binary-contrast or weak formula phrasing, **prefer** a **clearer, more specific** rewrite; **do not** treat pattern matches as automatic failure.
`;
}
