import { describe, expect, it } from "vitest";
import {
  buildBrainstormerOutputFallback,
  resolveDisplayUmbrella,
} from "@/lib/brainstormer/build-brainstormer-output-fallback";
import {
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { interpretBrainstormerTurnDeterministic } from "@/lib/brainstormer/interpret-brainstormer-turn";
import { mapInterpretationToTurnIntent } from "@/lib/brainstormer/turn-interpreter";
import {
  extractConfirmedConceptualUmbrella,
  isValidConceptualUmbrellaCandidate,
} from "@/lib/brainstormer/working-brief-memory";
import { validateBrainstormerOutputQuality } from "@/lib/brainstormer/validate-brainstormer-output-quality";

const BRAND = "Boringstore";

describe("Brainstormer — consultor natural (sin mensaje crudo como eje)", () => {
  it("A: «Y cómo hago eso?» — fallback no cita el mensaje como eje", () => {
    const msg = "Y cómo hago eso?";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.memory_update.update_umbrella).toBe(false);
    expect(interp.response_mode).toBe("advance_next_step");

    const fb = buildBrainstormerOutputFallback({
      turn_intent: mapInterpretationToTurnIntent(interp, { userMessage: msg }),
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      last_user_message: msg,
      interpretation: interp,
    }, { brand_name: BRAND });

    expect(fb).not.toMatch(/Yo trabajaría «Y cómo hago eso/i);
    expect(fb).not.toMatch(/como eje de la campaña/i);
    expect(fb).toMatch(/orden|concepto de campaña|audiencia/i);
  });

  it("B: «No entiendo» — explica simple, sin eje creativo nuevo", () => {
    const msg = "No entiendo";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.conversation_act).toBe("user_confusion");
    expect(interp.response_mode).toBe("explain_simple");

    const fb = buildBrainstormerOutputFallback({
      turn_intent: "user_confusion",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      last_user_message: msg,
      interpretation: interp,
    }, { brand_name: BRAND });

    expect(fb).toMatch(/Tienes razón|Lo explico más simple/i);
    expect(fb).not.toMatch(/Mi paraguas sería/i);
    expect(fb).not.toMatch(/«No entiendo»/i);

    const bad = "Yo trabajaría «No entiendo» como eje de la campaña.";
    const v = validateBrainstormerOutputQuality({
      assistant_message: bad,
      turn_intent: "user_confusion",
      thinking_model_key: "explorer",
      working_brief: emptyBrainstormerWorkingBrief(),
      last_user_message: msg,
      turn_interpretation: interp,
      brand_name: BRAND,
    });
    expect(v.ok).toBe(false);
  });

  it("C: sitio terminado + atraer clientes — no guarda frase como paraguas", () => {
    const msg = "Ya tengo el sitio terminado y necesito atraer clientes";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.memory_update.update_umbrella).toBe(false);

    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: interp,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("");
    expect(isValidConceptualUmbrellaCandidate(msg)).toBe(false);
    expect(
      extractConfirmedConceptualUmbrella({
        userMessage: msg,
        conversationExcerpt: "",
        priorUmbrella: "",
      }),
    ).toBeNull();
  });

  it("D: «Me gusta No sabías que lo querías» — solo ahí guarda paraguas", () => {
    const msg = "Me gusta 'No sabías que lo querías'";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.memory_update.update_umbrella).toBe(true);
    expect(interp.memory_update.umbrella_candidate).toBe("No sabías que lo querías");

    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: interp,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("No sabías que lo querías");
    expect(resolveDisplayUmbrella(brief, msg)).toBe("No sabías que lo querías");
  });

  it("E: repo sin «Yo trabajaría «{mensaje}» como eje» en fallbacks", () => {
    const forbidden = buildBrainstormerOutputFallback({
      turn_intent: "next_step",
      thinking_model_key: "explorer",
      working_brief: {
        ...emptyBrainstormerWorkingBrief(),
        confirmed_conceptual_umbrella: "Y cómo hago eso?",
      },
      last_user_message: "Y cómo hago eso?",
      interpretation: interpretBrainstormerTurnDeterministic({
        last_user_message: "Y cómo hago eso?",
        working_brief: emptyBrainstormerWorkingBrief(),
      }),
    }, { brand_name: BRAND });

    expect(forbidden).not.toMatch(/Yo trabajaría «Y cómo hago eso/i);
    expect(resolveDisplayUmbrella({
      ...emptyBrainstormerWorkingBrief(),
      confirmed_conceptual_umbrella: "Y cómo hago eso?",
    }, "Y cómo hago eso?")).toBe("");
  });
});
