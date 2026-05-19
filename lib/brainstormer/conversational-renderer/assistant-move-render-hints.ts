import type { ConversationDirectorAssistantMove } from "@/lib/brainstormer/conversation-director/types";

/** Forma de la respuesta visible por movimiento (sin decidir estrategia). */
export const ASSISTANT_MOVE_RENDER_HINTS_ES: Record<ConversationDirectorAssistantMove, string> = {
  ask_one_strategic_question:
    "1–2 frases de lectura situada con un dato de la base → cierra con next_best_question. Sin listas ni plan completo.",
  give_hypothesis_then_question:
    'Hipótesis explícita ("Mi hipótesis es que…" / "Leería que…") + 2–3 activos nombrados de la base + riesgo si aplica → next_best_question. No menú A/B/C sin hipótesis previa.',
  compare_options:
    "Menciona 2 rutas breves ancladas en la base → pide elegir con next_best_question. No más de 3 opciones en prosa.",
  propose_micro_plan:
    "Esquema mínimo (2–3 pasos en prosa, no bullets largos) → next_best_question sobre horizonte o prioridad.",
  repair_and_reframe:
    "Reconoce en una frase → recapitula 1–2 hechos concretos de known_from_brand_base → next_best_question de priorización.",
  suggest_research:
    "Reconoce necesidad de benchmark → qué puedes inferir ya de la base → next_best_question para acotar criterios. No inventar resultados de búsqueda.",
  suggest_project_seed:
    "Resume el hilo de session_progress en 1 frase → invitación suave a proyecto si should_suggest_project_conversion → next_best_question sobre tipo de proyecto.",
};
