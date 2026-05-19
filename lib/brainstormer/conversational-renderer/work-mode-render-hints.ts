import type { ConversationDirectorWorkMode } from "@/lib/brainstormer/conversation-director/types";

export const WORK_MODE_RENDER_HINTS_ES: Record<ConversationDirectorWorkMode, string> = {
  exploration:
    "Mantén tono exploratorio; una hipótesis breve si aplica, sin asumir entregable final.",
  strategic_focus:
    "Prioriza decisión estratégica (audiencia, territorio, oferta) antes de piezas o planes detallados.",
  project_seed:
    "Reconoce que la sesión ya tiene forma de proyecto preliminar; invita a ordenar entregables sin crear proyecto en producto.",
  deliverable_building:
    "Modo construcción: habla del entregable concreto (landing, pauta, guion, etc.). No redactes pieza final sin insumo.",
  research_needed:
    "Modo investigación: acota benchmark; no inventes datos externos.",
};

export function buildWorkModeRendererBlock(decision: {
  work_mode: ConversationDirectorWorkMode;
  concrete_deliverable_detected: boolean;
  detected_deliverable_type: string | null;
  should_request_user_material: boolean;
  requested_material_reason: string | null;
  transition_message: string | null;
  world_cup_ip_guardrail: boolean;
  should_suggest_project_conversion: boolean;
}): string {
  const lines = [
    `work_mode: ${decision.work_mode}`,
    `work_mode_render_hint: ${WORK_MODE_RENDER_HINTS_ES[decision.work_mode]}`,
    `concrete_deliverable_detected: ${String(decision.concrete_deliverable_detected)}`,
    `detected_deliverable_type: ${decision.detected_deliverable_type ?? "null"}`,
    `should_request_user_material: ${String(decision.should_request_user_material)}`,
    `requested_material_reason: ${decision.requested_material_reason ?? "null"}`,
    `world_cup_ip_guardrail: ${String(decision.world_cup_ip_guardrail)}`,
  ];

  if (decision.transition_message) {
    lines.push(
      "",
      "transition_message (weave naturally in Spanish — NOT as system/meta; open or integrate in first 2 sentences):",
      decision.transition_message,
    );
  }

  if (decision.should_request_user_material) {
    lines.push(
      "",
      "MATERIAL REQUEST (mandatory): Do NOT write final landing/copy until user shares the file or pastes content. Ask next_best_question about uploading/pasting.",
    );
  }

  if (decision.world_cup_ip_guardrail) {
    lines.push(
      "",
      "LEGAL GUARDRAIL (mandatory): Do NOT use official logos, marks or licensed imagery of third-party events, leagues or brands. Propose own visual territory inspired by the theme.",
    );
  }

  if (decision.should_suggest_project_conversion && decision.work_mode === "project_seed") {
    lines.push(
      "",
      "PROJECT SEED: Mention lightly that landing + pauta (or similar combo) already looks like a preliminary project — without triggering product conversion.",
    );
  }

  return lines.join("\n");
}
