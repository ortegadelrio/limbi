import { describe, expect, it } from "vitest";
import {
  CLARIFICATION_BTN_GUARDAR_Y_SEGUIR_ES,
  CLARIFICATION_BTN_PEDIR_ORIENTACION_ES,
  CLARIFICATION_THREAD_LABEL_ES,
} from "@/lib/questionnaire-evaluation/clarification-ui-strings";
import {
  isSubstantiveClarificationFreeText,
  shouldInvokeCoachOnGuardar,
} from "@/lib/questionnaire-evaluation/clarification-save-intercept";

describe("clarification UI strings", () => {
  it("exposes two distinct primary action labels (no single Siguiente)", () => {
    expect(CLARIFICATION_BTN_PEDIR_ORIENTACION_ES).toContain("Limbi");
    expect(CLARIFICATION_BTN_GUARDAR_Y_SEGUIR_ES).toContain("Guardar");
    expect(CLARIFICATION_BTN_PEDIR_ORIENTACION_ES).not.toBe(
      CLARIFICATION_BTN_GUARDAR_Y_SEGUIR_ES,
    );
    expect(CLARIFICATION_THREAD_LABEL_ES).toContain("Conversación con Limbi");
  });
});

describe("shouldInvokeCoachOnGuardar", () => {
  it("does not coach when universal skip is selected", () => {
    expect(
      shouldInvokeCoachOnGuardar({
        rawTrimmed: "No entiendo",
        universalSkipSelected: true,
      }),
    ).toBe(false);
  });

  it("coaches on help-only text", () => {
    expect(
      shouldInvokeCoachOnGuardar({
        rawTrimmed: "No entiendo",
        universalSkipSelected: false,
      }),
    ).toBe(true);
  });

  it("coaches on mixed substantive + help", () => {
    expect(
      shouldInvokeCoachOnGuardar({
        rawTrimmed:
          "Hombres y mujeres solteras con mascotas. Pero si me recomiendas a alguien más recibo sugerencias.",
        universalSkipSelected: false,
      }),
    ).toBe(true);
  });

  it("does not coach on substantive-only answer", () => {
    expect(
      shouldInvokeCoachOnGuardar({
        rawTrimmed:
          "Personas solteras o parejas sin hijos que viajan con sus mascotas y buscan lugares realmente pet friendly.",
        universalSkipSelected: false,
      }),
    ).toBe(false);
  });
});

describe("isSubstantiveClarificationFreeText", () => {
  it("rejects help-only and mixed drafts", () => {
    expect(isSubstantiveClarificationFreeText("Ayúdame")).toBe(false);
    expect(
      isSubstantiveClarificationFreeText(
        "Algo concreto. Qué me recomiendas para afinarlo?",
      ),
    ).toBe(false);
  });

  it("accepts concrete answers", () => {
    expect(
      isSubstantiveClarificationFreeText(
        "Personas solteras o parejas sin hijos que viajan con sus mascotas y buscan lugares realmente pet friendly.",
      ),
    ).toBe(true);
  });
});
