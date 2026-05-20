import { describe, expect, it } from "vitest";
import {
  applyConversationContractToDirector,
  buildConversationContractForTurn,
  buildConversationContractPromptBlock,
  buildWorkingBriefPromptBlock,
  classifyBrainstormerTurnIntent,
  shouldIncludeClosingQuestion,
  updateBrainstormerWorkingBrief,
  validateBrainstormerResponseContract,
  emptyBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import { BRAINSTORMER_PROMPT_HIERARCHY_RULE_EN } from "@/lib/brainstormer/brainstormer-prompt-hierarchy";
import {
  buildCompactThinkingModelPromptBlock,
  resolveThinkingModelForBrainstormer,
} from "@/lib/ai/thinking-models";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";

const directorGeneric: ConversationDirectorDecision = {
  assistant_move: "ask_one_strategic_question",
  work_mode: "exploration",
  challenge_type: "other",
  user_intent: "explore",
  conversation_stage: "opening",
  next_best_question: "¿Qué opinas de esta dirección?",
  question_id: "q1",
  question_asks_for: "feedback",
  question_reason: "generic",
  transition_message: null,
  should_request_user_material: false,
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

describe("classifyBrainstormerTurnIntent", () => {
  it("detecta pedido de concepto estratégico", () => {
    expect(
      classifyBrainstormerTurnIntent("Necesito un concepto estratégico para la campaña"),
    ).toBe("conceptual_strategy_request");
  });

  it("detecta delegación «dime tú»", () => {
    expect(classifyBrainstormerTurnIntent("Dime tú cómo lo llevarías")).toBe("delegate_to_limbi");
  });

  it("detecta rechazo de ruta", () => {
    expect(classifyBrainstormerTurnIntent("Me parece aburrido, no por ahí")).toBe("reject_route");
  });

  it("detecta siguiente paso", () => {
    expect(classifyBrainstormerTurnIntent("¿Cuál es el siguiente paso?")).toBe("next_step");
  });
});

describe("updateBrainstormerWorkingBrief", () => {
  it("acumula «posiblemente reales» en active_constraints", () => {
    const b1 = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: "Los personajes deben ser posiblemente reales",
    });
    expect(b1.active_constraints.some((c) => /posiblemente reales/i.test(c))).toBe(true);

    const b2 = updateBrainstormerWorkingBrief({
      prior: b1,
      userMessage: "Siguiente iteración",
    });
    expect(b2.active_constraints.some((c) => /posiblemente reales/i.test(c))).toBe(true);
  });

  it("acumula «con picardía» en active_constraints", () => {
    const b = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: "Tienen que tener picardía",
    });
    expect(b.active_constraints.some((c) => /picard/i.test(c))).toBe(true);
  });

  it("registra rechazo en rejected_paths", () => {
    const b = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: "Me parece aburrido, no me convence esa ruta",
    });
    expect(b.rejected_paths.length).toBeGreaterThan(0);
    expect(b.rejected_paths.join(" ")).toMatch(/aburrid/i);
  });
});

describe("buildConversationContractPromptBlock", () => {
  it("exige paraguas conceptual compacto para concepto estratégico", () => {
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: "Dame un concepto estratégico",
    });
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: "Dame un concepto estratégico",
    });
    const block = buildConversationContractPromptBlock(contract);
    expect(block).toContain("THIS TURN");
    expect(block).toMatch(/paraguas|concepto/i);
  });

  it("«Dime tú» obliga a proponer y puede incluir cierre de decisión", () => {
    const contract = buildConversationContractForTurn({
      brief: emptyBrainstormerWorkingBrief(),
      userMessage: "Dime tú",
      director: directorGeneric,
    });
    expect(contract.user_delegated_decision).toBe(true);
    expect(contract.include_closing_question).toBe(true);
    expect(contract.effective_closing_question).not.toMatch(/qué opinas/i);
    const refined = applyConversationContractToDirector(directorGeneric, contract);
    expect(refined.next_best_question).not.toMatch(/qué opinas/i);
  });

  it("bloques compactos compartidos por todos los modelos", () => {
    for (const key of ["limbi", "explorer", "architect", "empathic", "symbolic", "commercial"] as const) {
      const thinking = buildCompactThinkingModelPromptBlock({
        resolved: resolveThinkingModelForBrainstormer({
          selectedKey: key === "limbi" ? "limbi" : key,
          challengeText: "concepto estratégico",
        }),
      });
      const contract = buildConversationContractPromptBlock(
        buildConversationContractForTurn({
          brief: emptyBrainstormerWorkingBrief(),
          userMessage: "concepto estratégico",
        }),
      );
      expect(contract).toContain("THIS TURN");
      expect(thinking).toContain("THINKING MODEL");
      expect(thinking).toContain("Delta:");
    }
  });
});

describe("prompt v3 — orden y capas", () => {
  it("incluye core behavior y regla compacta en OUTPUT", () => {
    const built = buildBrainstormerOpenAIInput({
      brand_name: "Marca",
      session_title: "Sesión",
      brand_context_status: "ready",
      brand_context_has_pending_updates: false,
      brand_context_blocking_reasons: [],
      session_summary_progress: emptyBrainstormerSessionProgress(),
      conversation_excerpt: "user: concepto",
      conversation_director: directorGeneric,
      knowledge_payload: {},
      limbic_payload: {},
      working_brief_block: "WORKING BRIEF (memory)",
      conversation_contract_block: "THIS TURN — user asked: concepto",
      thinking_model_block: "THINKING MODEL — Disruptor",
      last_user_message: "concepto",
    });
    expect(built.full_input).toContain("BRAINSTORMER CORE BEHAVIOR");
    expect(built.full_input).toContain(BRAINSTORMER_PROMPT_HIERARCHY_RULE_EN);
    expect(built.full_input).not.toContain("BRAINSTORMER PROMPT LAYER HIERARCHY");
  });

  it("orden: DNA → brief → contract → thinking → director", () => {
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: "concepto estratégico con picardía",
    });
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: "concepto estratégico",
    });
    const built = buildBrainstormerOpenAIInput({
      brand_name: "Marca",
      session_title: "Sesión",
      brand_context_status: "ready",
      brand_context_has_pending_updates: false,
      brand_context_blocking_reasons: [],
      session_summary_progress: emptyBrainstormerSessionProgress(),
      conversation_excerpt: "user: concepto estratégico",
      conversation_director: directorGeneric,
      knowledge_payload: {},
      limbic_payload: {},
      working_brief_block: buildWorkingBriefPromptBlock(brief),
      conversation_contract_block: buildConversationContractPromptBlock(contract),
      thinking_model_block: buildCompactThinkingModelPromptBlock({
        resolved: resolveThinkingModelForBrainstormer({
          selectedKey: "limbi",
          challengeText: "concepto estratégico",
        }),
      }),
      last_user_message: "concepto estratégico",
    });

    const dnaIdx = built.full_input.indexOf("BRAND_DNA_FOR_BRAINSTORMER");
    const briefIdx = built.full_input.indexOf("WORKING BRIEF (memory)");
    const contractIdx = built.full_input.indexOf("THIS TURN", briefIdx + 1);
    const thinkingIdx = built.full_input.indexOf("THINKING MODEL", contractIdx + 1);
    const directorIdx = built.full_input.indexOf("DIRECTOR (compact)", thinkingIdx + 1);
    expect(dnaIdx).toBeGreaterThan(-1);
    expect(briefIdx).toBeGreaterThan(dnaIdx);
    expect(contractIdx).toBeGreaterThan(briefIdx);
    expect(thinkingIdx).toBeGreaterThan(contractIdx);
    expect(directorIdx).toBeGreaterThan(thinkingIdx);
  });
});

describe("validateBrainstormerResponseContract", () => {
  it("marca cierre genérico como violación", () => {
    const contract = buildConversationContractForTurn({
      brief: emptyBrainstormerWorkingBrief(),
      userMessage: "concepto",
    });
    const v = validateBrainstormerResponseContract({
      assistantMessage: "Aquí va la idea. ¿Qué opinas?",
      contract,
    });
    expect(v.ok).toBe(false);
    expect(v.violations.some((x) => x.includes("generic_closing"))).toBe(true);
  });

  it("siguiente paso: muchas viñetas es violación", () => {
    const contract = buildConversationContractForTurn({
      brief: emptyBrainstormerWorkingBrief(),
      userMessage: "siguiente paso",
    });
    const bullets = Array.from({ length: 6 }, (_, i) => `- Paso ${i + 1}`).join("\n");
    const v = validateBrainstormerResponseContract({
      assistantMessage: `${bullets}\n¿Seguimos?`,
      contract,
    });
    expect(v.violations).toContain("next_step_too_many_bullets");
  });
});

describe("shouldIncludeClosingQuestion", () => {
  it("no obliga cierre en paraguas conceptual anclado", () => {
    expect(
      shouldIncludeClosingQuestion(
        "conceptual_strategy_request",
        "No sabías que lo querías. ¿Cuál sería el paraguas conceptual?",
      ),
    ).toBe(false);
  });
});
