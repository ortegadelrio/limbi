import { describe, expect, it } from "vitest";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import { detectOptionSelection } from "@/lib/brainstormer/option-selection-advancement/detect-option-selection";
import { resolveNextQuestion } from "@/lib/brainstormer/question-engine/resolve-next-question";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const POSITIONING_ASSISTANT_Q =
  "assistant: ¿Quieres que este posicionamiento trabaje más para vender consultoría, conseguir conferencias o fortalecer autoridad pública?";

const emptySignals = {
  identity_or_positioning: ["Autoridad en marketing"],
  audiences: ["Líderes"],
  offer_or_roles: ["Consultoría", "Conferencias"],
  differentiators: [],
  credibility_assets: [],
  tone_or_limbic_cues: [],
  guardrails: [],
};

function directorAfterPositioningChoice(userMessage: string) {
  const progress = emptyBrainstormerSessionProgress();
  progress.current_challenge = "Posicionamiento marca personal";
  return resolveConversationDirector({
    user_message: userMessage,
    conversation_excerpt: `user: Quiero mejorar mi posicionamiento\n${POSITIONING_ASSISTANT_Q}`,
    session_progress: {
      session_summary: "Posicionamiento",
      current_challenge: progress.current_challenge,
      preliminary_objective: "",
      project_readiness: "low",
      should_suggest_project_conversion: false,
    },
    brand_signals: emptySignals,
    user_message_count: 3,
  });
}

describe("BRAIN-11 — Option Selection Advancement", () => {
  it("1. Conseguir conferencias → avanza, no pregunta seguimos/cambiamos", () => {
    const d = directorAfterPositioningChoice("Conseguir conferencias");
    expect(d.user_selected_previous_option).toBe(true);
    expect(d.user_intent).toBe("selected_option");
    expect(d.selected_option_focus).toBe("get_conferences");
    expect(d.assistant_move).toBe("give_hypothesis_then_question");
    expect(d.next_best_question).not.toMatch(/seguimos profundizando|cambiamos de foco/i);
    expect(d.next_best_question).toMatch(/empaquetar|conferencia|liderazgo|reputación|creatividad/i);
    expect(d.option_advancement_directive).toMatch(/NO preguntes.*seguimos/i);
  });

  it("2. Vender consultorías → foco consultoría", () => {
    const d = directorAfterPositioningChoice("Vender consultorías");
    expect(d.user_selected_previous_option).toBe(true);
    expect(d.selected_option_focus).toBe("sell_consulting");
    expect(d.next_best_question).toMatch(/consultoría/i);
  });

  it("3. Fortalecer autoridad pública → foco autoridad", () => {
    const d = directorAfterPositioningChoice("Fortalecer autoridad pública");
    expect(d.user_selected_previous_option).toBe(true);
    expect(d.selected_option_focus).toBe("public_authority");
    expect(d.next_best_question).toMatch(/autoridad/i);
  });

  it("4. Sí tras ideas del assistant → confirm_ideas, no unclear", () => {
    const d = resolveConversationDirector({
      user_message: "Sí",
      conversation_excerpt:
        "assistant: Te propongo tres rutas de ideas para explorar en esta sesión.",
      session_progress: {
        session_summary: "",
        current_challenge: "Ideas",
        preliminary_objective: "",
        project_readiness: "low",
        should_suggest_project_conversion: false,
      },
      brand_signals: emptySignals,
      user_message_count: 2,
    });
    expect(d.user_selected_previous_option).toBe(true);
    expect(d.selected_option_focus).toBe("confirm_ideas");
    expect(d.user_intent).toBe("selected_option");
    expect(d.next_best_question).not.toMatch(/seguimos profundizando/i);
  });

  it("5. Tengo notas → pedir pegar o subir", () => {
    const d = resolveConversationDirector({
      user_message: "Tengo unas notas",
      conversation_excerpt:
        "user: conferencia liderazgo\nassistant: ¿Cómo serían las secciones?",
      session_progress: {
        session_summary: "",
        current_challenge: "Conferencia",
        preliminary_objective: "",
        project_readiness: "medium",
        should_suggest_project_conversion: false,
      },
      brand_signals: emptySignals,
      user_message_count: 3,
    });
    expect(d.user_selected_previous_option).toBe(true);
    expect(d.selected_option_focus).toBe("has_notes_to_share");
    expect(d.next_best_question).toMatch(/pegar|subir|notas/i);
  });

  it("6. Question engine no elige cross-unclear tras selección", () => {
    const r = resolveNextQuestion({
      challenge_type: "positioning",
      user_intent: "selected_option",
      conversation_stage: "focusing",
      assistant_move: "give_hypothesis_then_question",
      known_from_brand_base: [],
      missing_information: [],
      user_selected_previous_option: true,
      session_progress: {
        session_summary: "x",
        current_challenge: "Posicionamiento",
        preliminary_objective: "",
      },
    });
    expect(r.candidate_id).not.toBe("cross-unclear-continue-challenge");
  });
});

describe("detectOptionSelection — detección aislada", () => {
  it("detecta conferencias con pregunta previa de posicionamiento", () => {
    const r = detectOptionSelection({
      user_message: "Conferencias",
      conversation_excerpt: POSITIONING_ASSISTANT_Q,
    });
    expect(r.user_selected_previous_option).toBe(true);
    expect(r.selected_option_focus).toBe("get_conferences");
  });
});
