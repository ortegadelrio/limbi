import {
  GLOBAL_AI_RULES,
  SYMBOLIC_NON_LITERAL_INSTRUCTION_EN,
} from "@/lib/ai/global-rules";
import {
  AVOIDED_VOICE_TRAIT_OPTIONS,
  COLOR_FEELING_OPTIONS,
  DESIRED_VOICE_TRAIT_OPTIONS,
  EMOTIONAL_COLOR_OPTIONS,
  EMOTIONAL_INTENSITY_OPTIONS,
  type LimbicSemanticOption,
  SENSORY_CLOTHING_OPTIONS,
  SENSORY_EMOTIONAL_AGE_OPTIONS,
  SENSORY_MOVEMENT_OPTIONS,
  SENSORY_SMELL_OPTIONS,
  VISUAL_ATMOSPHERE_OPTIONS,
} from "@/lib/constants/wizard";
import type {
  LimbicInterpretationResult,
  LimbicRawInputs,
  LimbicSymbolicMeanings,
  SymbolicSlugMap,
} from "./types";

function readSubRecord(
  responses: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const v = responses[key];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

function hintsForOption<V extends string | number>(
  options: readonly LimbicSemanticOption<V>[],
  value: unknown,
): readonly string[] {
  if (value === null || value === undefined) return [];
  const found = options.find((o) => o.value === (value as V));
  return found?.semanticHints ?? [];
}

function labelFor<V extends string>(
  options: readonly { value: V; label: string }[],
  slug: string,
): string {
  const o = options.find((x) => x.value === (slug as V));
  return o?.label ?? slug;
}

function slugMapFromStrings(
  slugs: string[],
  options: readonly LimbicSemanticOption<string>[],
  unknownMessages: string[],
  context: string,
): SymbolicSlugMap {
  const out: SymbolicSlugMap = {};
  for (const slug of slugs) {
    const hints = hintsForOption(options, slug);
    out[slug] = hints;
    if (hints.length === 0) {
      unknownMessages.push(`${context}: slug desconocido «${slug}»`);
    }
  }
  return out;
}

function dedupePreserveOrder(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function collectAllHints(meanings: LimbicSymbolicMeanings): string[] {
  const chunks: string[] = [];
  for (const hints of Object.values(meanings.selected_images)) {
    chunks.push(...hints);
  }
  chunks.push(...meanings.selected_color);
  chunks.push(...meanings.color_feeling);
  chunks.push(...meanings.sensory_choices.smell);
  chunks.push(...meanings.sensory_choices.movement);
  chunks.push(...meanings.sensory_choices.emotional_age);
  chunks.push(...meanings.sensory_choices.symbolic_clothing);
  chunks.push(...meanings.emotional_intensity.hints);
  for (const h of Object.values(meanings.desired_voice_traits)) {
    chunks.push(...h);
  }
  for (const h of Object.values(meanings.avoided_voice_traits)) {
    chunks.push(...h);
  }
  return dedupePreserveOrder(chunks);
}

/**
 * Transforma slugs guardados en `responses` en interpretación simbólica estructurada.
 * Completamente determinístico: sin red, sin OpenAI, sin generación de copy final.
 */
export function buildLimbicInterpretation(
  responses: Record<string, unknown>,
): LimbicInterpretationResult {
  const limbic = readSubRecord(responses, "limbic_base");
  const voice = readSubRecord(responses, "voice_base");

  const raw_inputs: LimbicRawInputs = {
    limbic_base: limbic,
    voice_base: voice,
  };

  const unknownWarnings: string[] = [];

  const selectedImages = Array.isArray(limbic.selected_images)
    ? limbic.selected_images.filter((x): x is string => typeof x === "string")
    : [];

  const symbolic_selected_images = slugMapFromStrings(
    selectedImages,
    VISUAL_ATMOSPHERE_OPTIONS as readonly LimbicSemanticOption<string>[],
    unknownWarnings,
    "limbic_base.selected_images",
  );

  const colorSlug =
    typeof limbic.selected_color === "string" ? limbic.selected_color : null;
  const feelingSlug =
    typeof limbic.color_feeling === "string" ? limbic.color_feeling : null;

  const selected_color = [...hintsForOption(EMOTIONAL_COLOR_OPTIONS, colorSlug)];
  if (colorSlug && selected_color.length === 0) {
    unknownWarnings.push(
      `limbic_base.selected_color: slug desconocido «${colorSlug}»`,
    );
  }

  const color_feeling = [...hintsForOption(COLOR_FEELING_OPTIONS, feelingSlug)];
  if (feelingSlug && color_feeling.length === 0) {
    unknownWarnings.push(
      `limbic_base.color_feeling: slug desconocido «${feelingSlug}»`,
    );
  }

  const sensory = limbic.sensory_choices;
  const sc =
    sensory && typeof sensory === "object" && !Array.isArray(sensory)
      ? (sensory as Record<string, unknown>)
      : {};

  const smellSlug = typeof sc.smell === "string" ? sc.smell : null;
  const movementSlug = typeof sc.movement === "string" ? sc.movement : null;
  const ageSlug =
    typeof sc.emotional_age === "string" ? sc.emotional_age : null;
  const clothingSlug =
    typeof sc.symbolic_clothing === "string" ? sc.symbolic_clothing : null;

  const smellHints = [...hintsForOption(SENSORY_SMELL_OPTIONS, smellSlug)];
  if (smellSlug && smellHints.length === 0) {
    unknownWarnings.push(`sensory_choices.smell: slug desconocido «${smellSlug}»`);
  }
  const movementHints = [
    ...hintsForOption(SENSORY_MOVEMENT_OPTIONS, movementSlug),
  ];
  if (movementSlug && movementHints.length === 0) {
    unknownWarnings.push(
      `sensory_choices.movement: slug desconocido «${movementSlug}»`,
    );
  }
  const ageHints = [
    ...hintsForOption(SENSORY_EMOTIONAL_AGE_OPTIONS, ageSlug),
  ];
  if (ageSlug && ageHints.length === 0) {
    unknownWarnings.push(
      `sensory_choices.emotional_age: slug desconocido «${ageSlug}»`,
    );
  }
  const clothingHints = [
    ...hintsForOption(SENSORY_CLOTHING_OPTIONS, clothingSlug),
  ];
  if (clothingSlug && clothingHints.length === 0) {
    unknownWarnings.push(
      `sensory_choices.symbolic_clothing: slug desconocido «${clothingSlug}»`,
    );
  }

  const eiRaw = limbic.emotional_intensity;
  const level =
    typeof eiRaw === "number" &&
    Number.isInteger(eiRaw) &&
    eiRaw >= 1 &&
    eiRaw <= 5
      ? eiRaw
      : null;
  const intensityOpt = EMOTIONAL_INTENSITY_OPTIONS.find((o) => o.value === level);
  const emotional_intensity = {
    level,
    label: intensityOpt?.label ?? null,
    hints: intensityOpt ? [...intensityOpt.semanticHints] : [],
  };
  if (eiRaw !== null && eiRaw !== undefined && level === null) {
    unknownWarnings.push(
      `limbic_base.emotional_intensity: valor no válido (${String(eiRaw)})`,
    );
  }

  const desiredSlugs = Array.isArray(voice.desired_voice_traits)
    ? voice.desired_voice_traits.filter((x): x is string => typeof x === "string")
    : [];
  const avoidedSlugs = Array.isArray(voice.avoided_voice_traits)
    ? voice.avoided_voice_traits.filter((x): x is string => typeof x === "string")
    : [];

  const desired_voice_traits = slugMapFromStrings(
    desiredSlugs,
    DESIRED_VOICE_TRAIT_OPTIONS as readonly LimbicSemanticOption<string>[],
    unknownWarnings,
    "voice_base.desired_voice_traits",
  );
  const avoided_voice_traits = slugMapFromStrings(
    avoidedSlugs,
    AVOIDED_VOICE_TRAIT_OPTIONS as readonly LimbicSemanticOption<string>[],
    unknownWarnings,
    "voice_base.avoided_voice_traits",
  );

  const vcRaw = voice.voice_comparison;
  let desiredPhrase: string | null = null;
  let avoidedPhrase: string | null = null;
  if (vcRaw && typeof vcRaw === "object" && !Array.isArray(vcRaw)) {
    const vc = vcRaw as Record<string, unknown>;
    desiredPhrase =
      typeof vc.desired === "string" && vc.desired.trim()
        ? vc.desired.trim()
        : null;
    avoidedPhrase =
      typeof vc.avoided === "string" && vc.avoided.trim()
        ? vc.avoided.trim()
        : null;
  }

  const symbolic_meanings: LimbicSymbolicMeanings = {
    selected_images: symbolic_selected_images,
    selected_color,
    color_feeling,
    sensory_choices: {
      smell: smellHints,
      movement: movementHints,
      emotional_age: ageHints,
      symbolic_clothing: clothingHints,
    },
    emotional_intensity,
    desired_voice_traits,
    avoided_voice_traits,
    voice_comparison: {
      desired: desiredPhrase,
      avoided: avoidedPhrase,
    },
  };

  const atmosphereParts: string[] = [];
  for (const [slug, hints] of Object.entries(symbolic_meanings.selected_images)) {
    const label = labelFor(VISUAL_ATMOSPHERE_OPTIONS, slug);
    if (hints.length) {
      atmosphereParts.push(`${label}: ${hints.join(", ")}`);
    }
  }
  if (symbolic_meanings.selected_color.length) {
    const c = colorSlug ? labelFor(EMOTIONAL_COLOR_OPTIONS, colorSlug) : "color";
    atmosphereParts.push(`${c}: ${symbolic_meanings.selected_color.join(", ")}`);
  }
  if (symbolic_meanings.color_feeling.length) {
    const f = feelingSlug
      ? labelFor(COLOR_FEELING_OPTIONS, feelingSlug)
      : "matiz";
    atmosphereParts.push(`${f}: ${symbolic_meanings.color_feeling.join(", ")}`);
  }
  if (smellHints.length) {
    const lab = smellSlug ? labelFor(SENSORY_SMELL_OPTIONS, smellSlug) : "olor";
    atmosphereParts.push(`${lab}: ${smellHints.join(", ")}`);
  }
  const combined_atmosphere = atmosphereParts.join(" · ");

  const creative_energyParts = [
    ...emotional_intensity.hints,
    ...movementHints,
    ...clothingHints,
  ];
  const creative_energy = dedupePreserveOrder(creative_energyParts).join(", ");

  const narrativeParts = [
    ...ageHints,
    ...color_feeling,
    ...emotional_intensity.hints.slice(0, 3),
  ];
  const narrative_rhythm = dedupePreserveOrder(narrativeParts).join(", ");

  const semantic_fields = collectAllHints(symbolic_meanings);

  const metaphorical_directions: string[] = [];
  if (atmosphereParts.length) {
    metaphorical_directions.push(`Atmósfera: ${combined_atmosphere}`);
  }
  if (movementHints.length || ageHints.length) {
    metaphorical_directions.push(
      `Movimiento y edad emocional: ${[...movementHints, ...ageHints].join(", ")}`,
    );
  }
  if (desiredPhrase || avoidedPhrase) {
    metaphorical_directions.push(
      `Contraste deseado (texto del usuario): como «${desiredPhrase ?? "—"}», nunca como «${avoidedPhrase ?? "—"}».`,
    );
  }

  const literal_usage_limits: string[] = [
    SYMBOLIC_NON_LITERAL_INSTRUCTION_EN,
    GLOBAL_AI_RULES,
    ...unknownWarnings.map((w) => `[trazabilidad] ${w}`),
  ];

  const voice_implications = desiredSlugs.map((slug) => {
    const lab = labelFor(DESIRED_VOICE_TRAIT_OPTIONS, slug);
    const hints = symbolic_meanings.desired_voice_traits[slug] ?? [];
    return hints.length
      ? `Voz deseada «${lab}»: ${hints.join(", ")}`
      : `Voz deseada «${lab}»: (sin pistas resueltas)`;
  });

  const avoidances = avoidedSlugs.map((slug) => {
    const lab = labelFor(AVOIDED_VOICE_TRAIT_OPTIONS, slug);
    const hints = symbolic_meanings.avoided_voice_traits[slug] ?? [];
    return hints.length
      ? `Evitar «${lab}»: ${hints.join(", ")}`
      : `Evitar «${lab}»: (sin pistas resueltas)`;
  });

  return {
    raw_inputs,
    symbolic_meanings,
    combined_atmosphere:
      combined_atmosphere ||
      "(Sin datos de atmósfera interpretables en limbic_base)",
    creative_energy:
      creative_energy ||
      "(Sin datos suficientes para energía creativa simbólica)",
    narrative_rhythm:
      narrative_rhythm || "(Sin datos suficientes para ritmo narrativo)",
    semantic_fields,
    metaphorical_directions,
    literal_usage_limits,
    voice_implications,
    avoidances,
  };
}
