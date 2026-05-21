import { describe, expect, it } from "vitest";
import { emptyBrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { interpretBrainstormerTurnDeterministic } from "@/lib/brainstormer/interpret-brainstormer-turn";
import { isExternalResearchRequest } from "@/lib/brainstormer/special-turn-detectors";

describe("isExternalResearchRequest — mensajes mixtos", () => {
  it("lanzamiento + investiga competidores → research (no solo launch)", () => {
    const msg =
      "Ya tengo la página terminada, quiero lanzarla, quisiera que antes de comenzar me investigues quienes son mis competidores";
    expect(isExternalResearchRequest(msg)).toBe(true);
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.conversation_act).toBe("external_research_request");
    expect(interp.memory_update.update_umbrella).toBe(false);
  });

  it("«quiénes son mis competidores? busca en internet» → research", () => {
    const msg = "Pero cuáles son mis competidores? busca en internet";
    expect(isExternalResearchRequest(msg)).toBe(true);
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.conversation_act).toBe("external_research_request");
  });

  it("«antes de comenzar investiga competidores» → research", () => {
    const msg = "Ya tengo la página lista, antes de comenzar investiga competidores";
    expect(isExternalResearchRequest(msg)).toBe(true);
  });

  it("solo lanzamiento sin verbo de investigación → no research", () => {
    const msg = "Ya tengo la página terminada y quiero lanzarla";
    expect(isExternalResearchRequest(msg)).toBe(false);
  });
});
