import {
  AUDIENCE_TYPE_OPTIONS,
  AVOIDED_VOICE_TRAIT_OPTIONS,
  CENTRAL_TENSION_OPTIONS,
  CHALLENGE_TYPE_OPTIONS,
  COLOR_FEELING_OPTIONS,
  CURRENT_EMOTION_OPTIONS,
  DESIRED_ACTION_OPTIONS,
  DESIRED_EMOTION_OPTIONS,
  DESIRED_VOICE_TRAIT_OPTIONS,
  EMOTIONAL_COLOR_OPTIONS,
  EMOTIONAL_INTENSITY_OPTIONS,
  EVIDENCE_TYPE_OPTIONS,
  MAIN_CHALLENGE_OPTIONS,
  NAME_STATUS_OPTIONS,
  OFFERING_TYPE_OPTIONS,
  PROBLEM_CATEGORY_OPTIONS,
  RESTRICTED_CLAIMS_OPTIONS,
  SENSORY_CLOTHING_OPTIONS,
  SENSORY_EMOTIONAL_AGE_OPTIONS,
  SENSORY_MOVEMENT_OPTIONS,
  SENSORY_SMELL_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
  VISUAL_ATMOSPHERE_OPTIONS,
  WHY_NOW_OPTIONS,
} from "@/lib/constants/wizard";

type Labeled = { value: string | number; label: string };

function collect(into: Record<string, string>, options: readonly Labeled[]) {
  for (const o of options) {
    into[String(o.value)] = o.label;
  }
}

/**
 * Mapa valor del cuestionario (slug / número) → etiqueta en español para humanizar citas.
 */
export const WIZARD_VALUE_TO_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  collect(m, NAME_STATUS_OPTIONS as readonly Labeled[]);
  collect(m, CHALLENGE_TYPE_OPTIONS as readonly Labeled[]);
  collect(m, MAIN_CHALLENGE_OPTIONS as readonly Labeled[]);
  collect(m, OFFERING_TYPE_OPTIONS as readonly Labeled[]);
  collect(m, PROBLEM_CATEGORY_OPTIONS as readonly Labeled[]);
  collect(m, TRANSFORMATION_TYPE_OPTIONS as readonly Labeled[]);
  collect(m, AUDIENCE_TYPE_OPTIONS as readonly Labeled[]);
  collect(m, CURRENT_EMOTION_OPTIONS as readonly Labeled[]);
  collect(m, DESIRED_EMOTION_OPTIONS as readonly Labeled[]);
  collect(m, DESIRED_ACTION_OPTIONS as readonly Labeled[]);
  collect(m, WHY_NOW_OPTIONS as readonly Labeled[]);
  collect(m, CENTRAL_TENSION_OPTIONS as readonly Labeled[]);
  collect(m, EVIDENCE_TYPE_OPTIONS as readonly Labeled[]);
  collect(m, RESTRICTED_CLAIMS_OPTIONS as readonly Labeled[]);
  collect(m, VISUAL_ATMOSPHERE_OPTIONS as readonly Labeled[]);
  collect(m, EMOTIONAL_COLOR_OPTIONS as readonly Labeled[]);
  collect(m, COLOR_FEELING_OPTIONS as readonly Labeled[]);
  collect(m, SENSORY_SMELL_OPTIONS as readonly Labeled[]);
  collect(m, SENSORY_MOVEMENT_OPTIONS as readonly Labeled[]);
  collect(m, SENSORY_EMOTIONAL_AGE_OPTIONS as readonly Labeled[]);
  collect(m, SENSORY_CLOTHING_OPTIONS as readonly Labeled[]);
  collect(m, EMOTIONAL_INTENSITY_OPTIONS as readonly Labeled[]);
  collect(m, DESIRED_VOICE_TRAIT_OPTIONS as readonly Labeled[]);
  collect(m, AVOIDED_VOICE_TRAIT_OPTIONS as readonly Labeled[]);
  return m;
})();

export const WIZARD_LABEL_KEYS_SORTED = Object.keys(WIZARD_VALUE_TO_LABEL).sort(
  (a, b) => b.length - a.length,
);
