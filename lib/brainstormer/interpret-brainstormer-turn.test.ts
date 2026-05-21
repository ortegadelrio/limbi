import { describe, expect, it } from "vitest";
import {
  buildConversationContractForTurn,
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { buildBrainstormerOutputFallback } from "@/lib/brainstormer/build-brainstormer-output-fallback";
import { validateBrainstormerOutputQuality } from "@/lib/brainstormer/validate-brainstormer-output-quality";
import {
  interpretBrainstormerTurnDeterministic,
  mapInterpretationToTurnIntent,
} from "@/lib/brainstormer/interpret-brainstormer-turn";

describe("interpretBrainstormerTurn — integración contrato y brief", () => {
  it("rechazo no actualiza paraguas vía brief", () => {
    const msg = "No me gusta ese insight, dame otras opciones";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: {
        ...emptyBrainstormerWorkingBrief(),
        confirmed_conceptual_umbrella: "No sabías que lo querías",
      },
    });
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: interp,
    });
    expect(interp.memory_update.update_umbrella).toBe(false);
    expect(brief.confirmed_conceptual_umbrella).toBe("");
  });

  it("contrato usa response_mode sin re-interpretar rechazo como confirmación", () => {
    const msg = "No me gusta ese insight, dame otras opciones";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: interp,
    });
    const contract = buildConversationContractForTurn({
      brief,
      userMessage: msg,
      interpretation: interp,
    });
    expect(contract.turn_intent).toBe(
      mapInterpretationToTurnIntent(interp),
    );
    expect(contract.response_obligation).toMatch(/alternativas|rechazo/i);
    expect(contract.prompt_deliver_hint).toMatch(/alternativas|rechazo/i);
  });

  it("quality gate falla si defiende paraguas en rechazo", () => {
    const msg = "No me gusta ese insight, dame otras opciones";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const bad =
      "Ese es el paraguas. No lo cambiaría; es la dirección correcta.";
    const v = validateBrainstormerOutputQuality({
      assistant_message: bad,
      turn_intent: mapInterpretationToTurnIntent(interp),
      thinking_model_key: "limbi",
      resolved_primary_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      last_user_message: msg,
      turn_interpretation: interp,
    });
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => /rechazo|paraguas/i.test(i))).toBe(true);
  });

  it("«siguiente paso» mapea a next_step para validación de contrato", () => {
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: "siguiente paso",
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.conversation_act).toBe("asking_next_step");
    expect(mapInterpretationToTurnIntent(interp, { userMessage: "siguiente paso" })).toBe(
      "next_step",
    );
  });

  it("fallback usa response_mode propose_alternatives", () => {
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: "dame otras opciones",
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const text = buildBrainstormerOutputFallback({
      turn_intent: mapInterpretationToTurnIntent(interp),
      thinking_model_key: "limbi",
      resolved_primary_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      interpretation: interp,
    });
    expect(text).toMatch(/paraguas|opciones|alternativ/i);
  });
});
