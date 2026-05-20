import { describe, expect, it } from "vitest";
import {
  assistantMessageAlreadyIncludesBrandBaseUpdateNotice,
  BRAND_BASE_UPDATED_SESSION_NOTICE_ES,
} from "@/lib/brainstormer/brainstormer-brand-base-updated-notice";
import {
  buildBrandDnaForBrainstormer,
} from "@/lib/brainstormer/build-brand-dna-for-brainstormer";
import { emptyBrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";

describe("sesión activa — base actualizada y memoria", () => {
  it("el aviso visible es el texto acordado", () => {
    expect(BRAND_BASE_UPDATED_SESSION_NOTICE_ES).toContain("Base de Marca fue actualizada");
    expect(BRAND_BASE_UPDATED_SESSION_NOTICE_ES).toContain("sin cambiar las ideas");
  });

  it("decisiones de sesión se conservan en ADN aunque cambie el payload de marca", () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
    brief.confirmed_decisions = ["Mantener producto falso en expectativa"];

    const oldBase = buildBrandDnaForBrainstormer({
      knowledge_payload: { executive_reading: "Marca vieja" },
      limbic_payload: {},
      working_brief: brief,
    });
    const newBase = buildBrandDnaForBrainstormer({
      knowledge_payload: { executive_reading: "Marca nueva consolidada" },
      limbic_payload: { symbolic_reading: "Nuevo tono" },
      working_brief: brief,
    });

    expect(oldBase.fields.approved_session_decisions).toContain("No sabías que lo querías");
    expect(newBase.fields.approved_session_decisions).toContain("No sabías que lo querías");
    expect(newBase.fields.brand_truth).toMatch(/Marca nueva/);
  });

  it("detecta si el aviso ya fue mostrado", () => {
    expect(
      assistantMessageAlreadyIncludesBrandBaseUpdateNotice([
        { role: "user", content: "hola" },
        { role: "assistant", content: `Prefijo\n${BRAND_BASE_UPDATED_SESSION_NOTICE_ES}\n\nRespuesta` },
      ]),
    ).toBe(true);
    expect(
      assistantMessageAlreadyIncludesBrandBaseUpdateNotice([
        { role: "assistant", content: "solo respuesta" },
      ]),
    ).toBe(false);
  });
});
