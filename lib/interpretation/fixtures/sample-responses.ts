/**
 * Fixture mínimo para probar buildLimbicInterpretation sin OpenAI ni BD.
 * Uso: import { SAMPLE_RESPONSES_LIMBIC } from "@/lib/interpretation/fixtures/sample-responses";
 *       import { buildLimbicInterpretation } from "@/lib/interpretation";
 *       const out = buildLimbicInterpretation(SAMPLE_RESPONSES_LIMBIC);
 */
export const SAMPLE_RESPONSES_LIMBIC: Record<string, unknown> = {
  limbic_base: {
    limbic_intro_seen: true,
    selected_images: ["rain", "airport", "black"],
    selected_color: "black",
    color_feeling: "elegant",
    sensory_choices: {
      smell: "coffee",
      movement: "airplane",
      emotional_age: "wise_person",
      symbolic_clothing: "minimal_black",
    },
    emotional_intensity: 4,
  },
  voice_base: {
    desired_voice_traits: ["human", "clear"],
    avoided_voice_traits: ["generic", "cold"],
    voice_comparison: {
      desired: "un café tranquilo",
      avoided: "un anuncio gritón",
    },
    voice_sentence_optional: "Nota opcional de ejemplo.",
  },
};
