import { describe, expect, it } from "vitest";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  classifyBrainstormerTurnIntent,
  isIdeationRequestType,
  isMaterialRequestClosingQuestion,
  updateBrainstormerWorkingBrief,
  emptyBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { detectWorkModeAndTransition } from "@/lib/brainstormer/conversation-director/detect-work-mode-and-transition";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

const directorMaterialAsk: ConversationDirectorDecision = {
  assistant_move: "ask_one_strategic_question",
  work_mode: "exploration",
  challenge_type: "other",
  user_intent: "explore",
  conversation_stage: "opening",
  next_best_question: "¿Puedes subir el brief o pegar aquí el contenido base?",
  question_id: "brain9-request-user-material",
  question_asks_for: "resources",
  question_reason: "material",
  transition_message: null,
  should_request_user_material: true,
  should_generate_content_now: false,
  should_suggest_project_conversion: false,
  should_use_web_search: false,
  user_has_no_material: false,
  deliverable_build_depth: null,
  current_deliverable_type: null,
  current_deliverable_section: null,
  deliverable_building_directive: null,
  consulting_style_mode: "default",
  consulting_style_directive: "",
  user_insight_anchor: null,
  typo_avoid_terms: [],
  allow_structured_sections_list: false,
  world_cup_ip_guardrail: false,
  known_from_brand_base: [],
  missing_information: [],
};

const boringstoreThread =
  "user: Quiero lanzar la marca\n\nuser: Quisiera algo diferente, deberíamos hacer una campaña de expectativa antes?";

describe("conversation contract — lanzamiento Disruptor", () => {
  it("detecta lanzamiento de marca y campaña de expectativa", () => {
    expect(classifyBrainstormerTurnIntent("Quiero lanzar la marca", boringstoreThread)).toBe(
      "launch_strategy",
    );
    expect(
      classifyBrainstormerTurnIntent(
        "Quisiera algo diferente, deberíamos hacer una campaña de expectativa antes?",
        boringstoreThread,
      ),
    ).toBe("campaign_expectation");
  });

  it("no pide archivo como next_best_question en ideación", () => {
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: "Quisiera algo diferente, deberíamos hacer una campaña de expectativa antes?",
      conversationExcerpt: boringstoreThread,
    });
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: "Quisiera algo diferente, deberíamos hacer una campaña de expectativa antes?",
      conversationExcerpt: boringstoreThread,
      director: directorMaterialAsk,
      thinkingPrimaryKey: "explorer",
      brandCredibilityAssets: [],
    });
    const director = applyConversationContractToDirector(directorMaterialAsk, contract);

    expect(isIdeationRequestType(contract.turn_intent)).toBe(true);
    expect(director.should_request_user_material).toBe(false);
    expect(isMaterialRequestClosingQuestion(director.next_best_question)).toBe(false);
    expect(director.next_best_question).toMatch(/misteriosa|humor|provocadora|expectativa|paraguas/i);
  });

  it("contract exige etapas + paraguas y prohíbe tácticas genéricas", () => {
    const contract = buildConversationContractForTurn({
      brief: updateBrainstormerWorkingBrief({
        prior: emptyBrainstormerWorkingBrief(),
        userMessage: "¿deberíamos hacer una campaña de expectativa antes?",
        conversationExcerpt: boringstoreThread,
      }),
      userMessage: "¿deberíamos hacer una campaña de expectativa antes?",
      conversationExcerpt: boringstoreThread,
      thinkingPrimaryKey: "explorer",
      brandCredibilityAssets: [],
    });
    const block = buildConversationContractPromptBlock(contract);
    expect(block).toMatch(/expectativa|lanzamiento|sostenimiento/i);
    expect(block).toMatch(/paraguas|concepto/i);
    expect(contract.forbidden_response_patterns.join(" ")).toMatch(/teasers|influencers|contenidos interactivos/i);
    expect(contract.response_obligation).toMatch(/prosa|postura|expectativa/i);
    expect(contract.response_obligation).not.toMatch(/2–3 paraguas conceptuales/i);
  });

  it("marca en lanzamiento: no testimonios sin evidencia", () => {
    const contract = buildConversationContractForTurn({
      brief: updateBrainstormerWorkingBrief({
        prior: { ...emptyBrainstormerWorkingBrief(), strategic_moment: "launch" },
        userMessage: "Quiero lanzar la marca",
        conversationExcerpt: boringstoreThread,
      }),
      userMessage: "Quiero lanzar la marca",
      thinkingPrimaryKey: "explorer",
      brandCredibilityAssets: [],
    });
    expect(contract.response_obligation).toMatch(/testimonios|clientes satisfechos/i);
    expect(contract.forbidden_response_patterns.join(" ")).toMatch(/testimonio|clientes satisfechos/i);
  });

  it("work mode: no should_request_user_material en ideación de lanzamiento", () => {
    const r = detectWorkModeAndTransition({
      user_message: "Quisiera algo diferente, campaña de expectativa antes del lanzamiento",
      conversation_excerpt: boringstoreThread,
      user_intent: "explore",
      challenge_type: "campaign",
      session_progress: {
        current_challenge: "Lanzar la marca",
        preliminary_objective: "",
        project_readiness: "low",
        should_suggest_project_conversion: false,
      },
    });
    expect(r.should_request_user_material).toBe(false);
  });
});
