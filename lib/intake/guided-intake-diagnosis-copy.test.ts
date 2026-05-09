import { describe, expect, it } from "vitest";
import {
  GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES,
  GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES,
} from "@/lib/intake/guided-intake-diagnosis-copy";

describe("guided intake diagnosis CTA copy", () => {
  it("exposes stable Spanish labels for the pilot completion screen", () => {
    expect(GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES).toContain("diagnóstico");
    expect(GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES.length).toBeGreaterThan(10);
    expect(GUIDED_INTAKE_DIAGNOSIS_PRIMARY_CTA_ES).not.toEqual(
      GUIDED_INTAKE_DIAGNOSIS_SECONDARY_CTA_ES,
    );
  });
});
