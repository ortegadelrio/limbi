import { describe, expect, it } from "vitest";
import {
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { applyTurnInterpretationToWorkingBrief } from "@/lib/brainstormer/apply-turn-interpretation";
import {
  interpretBrainstormerTurnDeterministic,
  mapInterpretationToTurnIntent,
  priorHasConfirmedConcept,
} from "@/lib/brainstormer/turn-interpreter";

const UMBRELLA = "No sabías que lo querías";

function briefWithUmbrella(umbrella = UMBRELLA) {
  return {
    ...emptyBrainstormerWorkingBrief(),
    confirmed_conceptual_umbrella: umbrella,
    strategy_stage: "concept_confirmed" as const,
  };
}

describe("Turn Interpreter — matriz de actos conversacionales", () => {
  it("A: sitio listo + falta campaña → asking_strategy, sin paraguas, guide_to_concept", () => {
    const msg =
      "Ya tengo el sitio listo, me falta la campaña";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(r.conversation_act).toBe("asking_strategy");
    expect(r.response_mode).toBe("guide_to_concept");
    expect(r.memory_update.update_umbrella).toBe(false);
    expect(r.memory_update.umbrella_candidate).toBeNull();
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: r,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("");
  });

  it("B: propuesta de concepto entre comillas → confirming, update_umbrella", () => {
    const msg = "Me gusta más ir directo a 'No sabías que lo querías'";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(["proposing_concept", "confirming_concept"]).toContain(r.conversation_act);
    expect(r.memory_update.update_umbrella).toBe(true);
    expect(r.memory_update.umbrella_candidate).toBe(UMBRELLA);
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: r,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe(UMBRELLA);
  });

  it("C: rechazo + alternativas → rejecting/asking_alternatives, sin paraguas", () => {
    const msg = "No me gusta ese insight, dame otras opciones";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: briefWithUmbrella(),
    });
    expect(["rejecting_concept", "asking_alternatives"]).toContain(r.conversation_act);
    expect(r.response_mode).toBe("propose_alternatives");
    expect(r.memory_update.update_umbrella).toBe(false);
    expect(r.memory_update.reject_current_concept).toBe(true);
  });

  it("D: corrección pidiendo otras opciones de conceptos → asking_alternatives, sin paraguas", () => {
    const msg = "Nooo, te estoy pidiendo otras opciones de conceptos";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: briefWithUmbrella(),
    });
    expect(r.conversation_act).toBe("asking_alternatives");
    expect(r.memory_update.update_umbrella).toBe(false);
    const brief = applyTurnInterpretationToWorkingBrief({
      prior: briefWithUmbrella(),
      interpretation: r,
      userMessage: msg,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe(UMBRELLA);
  });

  it("E: confusión → user_confusion, explain_simple, sin paraguas", () => {
    const msg = "Sigo sin entender";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(r.conversation_act).toBe("user_confusion");
    expect(r.response_mode).toBe("explain_simple");
    expect(r.memory_update.update_umbrella).toBe(false);
  });

  it("F: audiencia → asking_audience, answer_audience, sin paraguas", () => {
    const msg = "A quién estaría enfocado?";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(r.conversation_act).toBe("asking_audience");
    expect(r.response_mode).toBe("answer_audience");
    expect(r.memory_update.update_umbrella).toBe(false);
  });

  it("G: siguiente paso con paraguas → asking_next_step, advance_next_step, no concept_needed", () => {
    const msg = "Qué me aconsejas hacer ahora?";
    const prior = briefWithUmbrella();
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: prior,
    });
    expect(r.conversation_act).toBe("asking_next_step");
    expect(r.response_mode).toBe("advance_next_step");
    expect(r.memory_update.update_umbrella).toBe(false);
    expect(r.strategy_stage).not.toBe("concept_needed");
    const brief = updateBrainstormerWorkingBrief({
      prior,
      userMessage: msg,
      interpretation: r,
    });
    expect(priorHasConfirmedConcept(brief)).toBe(true);
    expect(brief.strategy_stage).not.toBe("concept_needed");
  });

  it("H: validación con paraguas → validating_concept, validate_concept", () => {
    const msg = "Cómo defino si este mensaje le pega a mi audiencia?";
    const prior = briefWithUmbrella();
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: prior,
    });
    expect(r.conversation_act).toBe("validating_concept");
    expect(r.response_mode).toBe("validate_concept");
    expect(r.strategy_stage).not.toBe("concept_needed");
  });

  it("I: táctica sin concepto → asking_tactics, guide_to_concept", () => {
    const msg = "Hazme los posts";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(r.conversation_act).toBe("asking_tactics");
    expect(r.response_mode).toBe("guide_to_concept");
  });

  it("etapa de campaña con sketch → campaign_stage_inquiry en contrato", () => {
    const msg =
      "¿Esto qué etapa de campaña es? Tenemos un sketch de producto falso para expectativa.";
    const prior = briefWithUmbrella();
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: prior,
    });
    expect(mapInterpretationToTurnIntent(r, { userMessage: msg })).toBe(
      "campaign_stage_inquiry",
    );
  });

  it("J: táctica con concepto → asking_tactics, answer_tactic_if_ready", () => {
    const msg = "Hazme los posts";
    const r = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: briefWithUmbrella(),
    });
    expect(r.conversation_act).toBe("asking_tactics");
    expect(r.response_mode).toBe("answer_tactic_if_ready");
  });
});
