import { describe, expect, it } from "vitest";
import {
  detectEvidenceStepAudienceStakeholderInput,
  detectEvidenceStepPositioningClaim,
} from "@/lib/intake/guided-intake-evidence-input-classifier";

describe("detectEvidenceStepAudienceStakeholderInput", () => {
  it("detects actor-importance phrasing without domain exemplars", () => {
    expect(
      detectEvidenceStepAudienceStakeholderInput(
        "La entidad que firma el contrato y sus equipos de operación. También es un actor importante en la decisión final.",
      ),
    ).toBe(true);
  });

  it("does not fire on trajectory-style evidence", () => {
    expect(
      detectEvidenceStepAudienceStakeholderInput(
        "Llevamos más de diez años de experiencia vendiendo este tipo de servicios con resultados medibles.",
      ),
    ).toBe(false);
  });
});

describe("detectEvidenceStepPositioningClaim", () => {
  it("detects premium positioning without proof", () => {
    expect(detectEvidenceStepPositioningClaim("Es un servicio premium.")).toBe(true);
  });

  it("does not steal audience-actor lines", () => {
    expect(
      detectEvidenceStepPositioningClaim(
        "La organización que contrata y sus equipos. También es un actor importante.",
      ),
    ).toBe(false);
  });
});
