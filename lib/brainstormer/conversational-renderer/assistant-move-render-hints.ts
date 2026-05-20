import type { ConversationDirectorAssistantMove } from "@/lib/brainstormer/conversation-director/types";

/** Forma visible por movimiento — conversación natural, sin plantilla. */
export const ASSISTANT_MOVE_RENDER_HINTS_ES: Record<ConversationDirectorAssistantMove, string> = {
  ask_one_strategic_question:
    "1–2 frases situadas con un dato de la base → una pregunta concreta. Sin listas ni encabezados.",
  give_hypothesis_then_question:
    'Postura en prosa ("Yo lo leería así…" / "Mi lectura es…") con 1–2 datos de la base → pregunta si hace falta. No menú A/B/C.',
  compare_options:
    "Solo si el director pide comparar: 2 rutas en prosa breve → pregunta de elección. Si no pidieron alternativas, una sola recomendación.",
  propose_micro_plan:
    "Ruta en prosa fluida (ej. cuatro momentos en una frase), no bullets largos ni títulos de sección.",
  repair_and_reframe:
    "Reconoce en una frase → recapitula hechos de la base → pregunta concreta si aplica.",
  suggest_research:
    "Qué puedes inferir ya de la base → pregunta para acotar. No inventar benchmark.",
  suggest_project_seed:
    "Una frase de continuidad → invitación suave a proyecto si aplica → pregunta breve.",
};
