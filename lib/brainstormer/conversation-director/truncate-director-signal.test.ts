import { describe, expect, it } from "vitest";
import { conversationDirectorDecisionSchema } from "@/lib/brainstormer/conversation-director/types";
import { truncateDirectorSignal } from "@/lib/brainstormer/conversation-director/truncate-director-signal";
import { sanitizeConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/sanitize-conversation-director-decision";
import { coerceConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/coerce-conversation-director-decision";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

describe("truncateDirectorSignal", () => {
  it("trunca strings largos con elipsis", () => {
    const long = "a".repeat(600);
    const out = truncateDirectorSignal(long, 480);
    expect(out.length).toBeLessThanOrEqual(480);
    expect(out.endsWith("…")).toBe(true);
  });

  it("colapsa espacios en blanco", () => {
    expect(truncateDirectorSignal("  hola   mundo  ")).toBe("hola mundo");
  });
});

describe("sanitizeConversationDirectorDecision", () => {
  it("known_from_brand_base pasa validación Zod tras señales largas", () => {
    const huge = "x".repeat(800);
    const sanitized = sanitizeConversationDirectorDecision({
      challenge_type: "positioning",
      user_intent: "explore",
      conversation_stage: "opening",
      known_from_brand_base: [`Identidad: ${huge}`],
      missing_information: [],
      assistant_move: "give_hypothesis_then_question",
      next_best_question: "¿Prioridad?",
      question_id: "positioning-opening-perception-priority",
      question_asks_for: "perception_priority",
      question_reason: "Test",
      should_use_web_search: false,
      web_search_reason: null,
      should_suggest_project_conversion: false,
      project_readiness: "low",
      work_mode: "exploration",
      concrete_deliverable_detected: false,
      detected_deliverable_type: null,
      should_request_user_material: false,
      requested_material_reason: null,
      transition_message: null,
      world_cup_ip_guardrail: false,
      consulting_style_mode: "default",
      consulting_style_directive: "Voz consultor.",
      user_insight_anchor: null,
      typo_avoid_terms: [],
      allow_structured_sections_list: false,
      user_selected_previous_option: false,
      selected_option_focus: null,
      option_advancement_directive: null,
      user_has_no_material: false,
      current_deliverable_type: null,
      current_deliverable_section: null,
      deliverable_build_depth: "outline",
      should_generate_content_now: false,
      deliverable_building_directive: null,
    });
    const parsed = conversationDirectorDecisionSchema.safeParse(sanitized);
    expect(parsed.success).toBe(true);
    expect(sanitized.known_from_brand_base[0]!.length).toBeLessThanOrEqual(480);
  });
});

describe("coerceConversationDirectorDecision", () => {
  it("no lanza si el raw tiene strings inválidos: usa fallback", () => {
    const progress = emptyBrainstormerSessionProgress();
    const input = {
      user_message: "hola",
      conversation_excerpt: "user: hola",
      session_progress: {
        session_summary: progress.session_summary,
        current_challenge: progress.current_challenge,
        preliminary_objective: progress.preliminary_objective,
        project_readiness: progress.project_readiness,
        should_suggest_project_conversion: progress.should_suggest_project_conversion,
      },
      brand_signals: {
        identity_or_positioning: ["x".repeat(900)],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 1,
    };

    const raw = resolveConversationDirector(input);
    expect(raw.known_from_brand_base.every((s) => s.length <= 480)).toBe(true);

    const coerced = coerceConversationDirectorDecision(
      {
        ...raw,
        known_from_brand_base: ["y".repeat(600)],
      },
      input,
    );
    const parsed = conversationDirectorDecisionSchema.safeParse(coerced);
    expect(parsed.success).toBe(true);
    expect(coerced.known_from_brand_base[0]!.length).toBeLessThanOrEqual(480);
    expect(coerced.challenge_type).toBe("unknown");
  });

  it("usa fallback si el valor sanitizado sigue siendo inválido para Zod", () => {
    const progress = emptyBrainstormerSessionProgress();
    const input = {
      user_message: "hola",
      conversation_excerpt: "",
      session_progress: {
        session_summary: "",
        current_challenge: "",
        preliminary_objective: "",
        project_readiness: progress.project_readiness,
        should_suggest_project_conversion: false,
      },
      brand_signals: {
        identity_or_positioning: [],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 1,
    };

    const coerced = coerceConversationDirectorDecision(
      {
        challenge_type: "invalid_type" as "unknown",
        user_intent: "explore",
        conversation_stage: "opening",
        known_from_brand_base: [],
        missing_information: [],
        assistant_move: "ask_one_strategic_question",
        next_best_question: "¿Cuál es el resultado concreto que necesitas en las próximas dos semanas?",
        question_id: "cross-fallback-two-week-outcome",
        question_asks_for: "objective",
        question_reason: "Test",
        should_use_web_search: false,
        web_search_reason: null,
        should_suggest_project_conversion: false,
        project_readiness: "low",
        work_mode: "exploration",
        concrete_deliverable_detected: false,
        detected_deliverable_type: null,
        should_request_user_material: false,
        requested_material_reason: null,
        transition_message: null,
        world_cup_ip_guardrail: false,
        consulting_style_mode: "default",
        consulting_style_directive: "Test",
        user_insight_anchor: null,
        typo_avoid_terms: [],
        allow_structured_sections_list: false,
        user_selected_previous_option: false,
        selected_option_focus: null,
        option_advancement_directive: null,
        user_has_no_material: false,
        current_deliverable_type: null,
        current_deliverable_section: null,
        deliverable_build_depth: "outline",
        should_generate_content_now: false,
        deliverable_building_directive: null,
      },
      input,
    );
    expect(conversationDirectorDecisionSchema.safeParse(coerced).success).toBe(true);
    expect(coerced.assistant_move).toBe("ask_one_strategic_question");
    expect(coerced.challenge_type).toBe("unknown");
  });
});
