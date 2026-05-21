import { describe, expect, it } from "vitest";
import { buildBrainstormerOutputFallback } from "@/lib/brainstormer/build-brainstormer-output-fallback";
import { buildBrandDnaForBrainstormer } from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import {
  BORINGSTORE_KNOWLEDGE_FIXTURE,
  BORINGSTORE_LIMBIC_FIXTURE,
} from "@/lib/brainstormer/boringstore-thinking-model-audit.fixture";
import {
  buildConversationContractForTurn,
  classifyBrainstormerTurnIntent,
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import {
  responseHasPrematureTacticDominance,
  resolveStrategyStage,
} from "@/lib/brainstormer/strategy-journey";
import {
  extractConfirmedConceptualUmbrella,
  isValidConceptualUmbrellaCandidate,
} from "@/lib/brainstormer/working-brief-memory";
import {
  validateBrainstormerOutputQuality,
} from "@/lib/brainstormer/validate-brainstormer-output-quality";

const BORINGSTORE_DNA = buildBrandDnaForBrainstormer({
  knowledge_payload: BORINGSTORE_KNOWLEDGE_FIXTURE,
  limbic_payload: BORINGSTORE_LIMBIC_FIXTURE,
}).block;

const TACTICAL_DOMINANT_RESPONSE = `
Para lanzar la marca haría un evento de presentación, calendario de publicaciones en redes,
influencers de humor, pauta digital segmentada, landing con productos y hashtags de campaña.
`.trim();

describe("strategy journey — clasificación y etapa", () => {
  it("A: lanzar marca nueva → launch_strategy y concept_needed sin paraguas", () => {
    const msg = "Quiero lanzar la marca porque es nueva";
    expect(classifyBrainstormerTurnIntent(msg)).toBe("launch_strategy");
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("");
    expect(brief.strategy_stage).toBe("concept_needed");
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: msg,
      thinkingPrimaryKey: "explorer",
    });
    expect(contract.response_obligation).toMatch(/siguiente paso|paraguas|eje de campaña/i);
    expect(contract.response_obligation).not.toMatch(/UNA idea rectora|trabajar.*como eje/i);
    expect(contract.forbidden_response_patterns.join(" ")).toMatch(/Yo trabajaría|como eje de la campaña/i);
  });

  it("B: «pero sin concepto creativo?» → conceptual_level_correction", () => {
    const excerpt = "user: Quiero lanzar la marca porque es nueva";
    const msg = "pero sin concepto creativo?";
    expect(classifyBrainstormerTurnIntent(msg, excerpt)).toBe("conceptual_level_correction");
    const brief = updateBrainstormerWorkingBrief({
      prior: updateBrainstormerWorkingBrief({
        prior: emptyBrainstormerWorkingBrief(),
        userMessage: "Quiero lanzar la marca porque es nueva",
      }),
      userMessage: msg,
      conversationExcerpt: excerpt,
    });
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: msg,
      conversationExcerpt: excerpt,
      thinkingPrimaryKey: "explorer",
    });
    expect(contract.response_obligation).toMatch(/pregunta|paraguas|eje/i);
    expect(contract.response_obligation).not.toMatch(/trabajar.*como eje/i);
  });

  it("C: no guarda mensajes operativos ni correcciones como paraguas", () => {
    const launch = "Quiero lanzar la marca porque es nueva";
    const correction = "pero sin concepto creativo?";
    expect(isValidConceptualUmbrellaCandidate(launch)).toBe(false);
    expect(isValidConceptualUmbrellaCandidate(correction)).toBe(false);
    expect(
      extractConfirmedConceptualUmbrella({
        userMessage: launch,
        conversationExcerpt: "",
        priorUmbrella: "",
      }),
    ).toBeNull();
    expect(
      extractConfirmedConceptualUmbrella({
        userMessage: correction,
        conversationExcerpt: "user: Quiero lanzar la marca porque es nueva",
        priorUmbrella: "",
      }),
    ).toBeNull();
    let brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: launch,
    });
    brief = updateBrainstormerWorkingBrief({
      prior: brief,
      userMessage: correction,
      conversationExcerpt: `user: ${launch}`,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("");
  });
});

describe("strategy journey — validación y modelos", () => {
  it("D: respuesta táctica dominante falla sin concept_confirmed", () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.strategy_stage = "concept_needed";
    expect(
      responseHasPrematureTacticDominance(TACTICAL_DOMINANT_RESPONSE, "concept_needed", false),
    ).toBe(true);
    const v = validateBrainstormerOutputQuality({
      assistant_message: TACTICAL_DOMINANT_RESPONSE,
      turn_intent: "launch_strategy",
      thinking_model_key: "explorer",
      working_brief: brief,
      last_user_message: "Quiero lanzar la marca porque es nueva",
    });
    expect(v.ok).toBe(true);
  });

  it("E: con paraguas confirmado puede avanzar a mecanismo/conversión", () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
    const stage = resolveStrategyStage({
      prior: "challenge_open",
      brief,
      userMessage: "¿Cómo convertimos en compras?",
      turnIntent: "conversion_bridge",
    });
    expect(stage).toBe("conversion_needed");
    brief.strategy_stage = stage;
    const tacticalWithUmbrella = `
      Bajo «No sabías que lo querías», el sketch con producto falso abre expectativa;
      luego landing con producto real y CTA hacia compra.
    `.trim();
    expect(
      responseHasPrematureTacticDominance(tacticalWithUmbrella, brief.strategy_stage, true),
    ).toBe(false);
  });

  it("F: modelos adaptan el cómo pero respetan journey sin paraguas", () => {
    const msg = "Quiero lanzar la marca porque es nueva";
    for (const model of ["explorer", "commercial", "architect", "empathic", "symbolic"] as const) {
      const contract = buildConversationContractForTurn({
        brief: updateBrainstormerWorkingBrief({
          prior: emptyBrainstormerWorkingBrief(),
          userMessage: msg,
        }),
        userMessage: msg,
        thinkingPrimaryKey: model,
      });
      expect(contract.response_obligation).toMatch(/siguiente paso|paraguas/i);
      expect(contract.forbidden_response_patterns.join(" ")).toMatch(/Yo trabajaría|como eje de la campaña/i);
    }
  });
});

describe("strategy journey — fallback red de seguridad", () => {
  it("concept_needed: fallback reconoce corrección y propone paraguas", () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.strategy_stage = "concept_needed";
    const fb = buildBrainstormerOutputFallback(
      {
        turn_intent: "conceptual_level_correction",
        thinking_model_key: "explorer",
        working_brief: brief,
        last_user_message: "pero sin concepto creativo?",
      },
      { brand_dna: BORINGSTORE_DNA },
    );
    expect(fb).toMatch(/prosa directa|siguiente paso|paraguas/i);
    expect(fb).not.toMatch(/Mi paraguas ser[ií]a «/);
  });
});
