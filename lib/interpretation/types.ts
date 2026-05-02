/**
 * Resultado de buildLimbicInterpretation(responses).
 * La IA futura debe priorizar estos campos frente a slugs sueltos.
 */

export type LimbicRawInputs = {
  limbic_base: Record<string, unknown>;
  voice_base: Record<string, unknown>;
};

/** Significado por slug: array de hints (vacío si slug desconocido). */
export type SymbolicSlugMap = Record<string, readonly string[]>;

export type LimbicSymbolicMeanings = {
  selected_images: SymbolicSlugMap;
  selected_color: readonly string[];
  color_feeling: readonly string[];
  sensory_choices: {
    smell: readonly string[];
    movement: readonly string[];
    emotional_age: readonly string[];
    symbolic_clothing: readonly string[];
  };
  emotional_intensity: {
    level: number | null;
    label: string | null;
    hints: readonly string[];
  };
  desired_voice_traits: SymbolicSlugMap;
  avoided_voice_traits: SymbolicSlugMap;
  voice_comparison: {
    desired: string | null;
    avoided: string | null;
  };
};

export type LimbicInterpretationResult = {
  raw_inputs: LimbicRawInputs;
  symbolic_meanings: LimbicSymbolicMeanings;
  combined_atmosphere: string;
  creative_energy: string;
  narrative_rhythm: string;
  semantic_fields: string[];
  metaphorical_directions: string[];
  literal_usage_limits: string[];
  voice_implications: string[];
  avoidances: string[];
};
