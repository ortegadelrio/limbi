import { describe, expect, it } from "vitest";
import {
  evidenceTypeSlugToSpanishPublicLabel,
  formatEvidenceTypeSlugsForUserFacingSummary,
} from "@/lib/intake/evidence-public-labels";

describe("evidenceTypeSlugToSpanishPublicLabel", () => {
  it("maps experience to human Spanish", () => {
    expect(evidenceTypeSlugToSpanishPublicLabel("experience")).toMatch(/trayectoria|experiencia/i);
    expect(evidenceTypeSlugToSpanishPublicLabel("experience")).not.toMatch(/^experience$/i);
  });

  it("maps wizard option values", () => {
    expect(evidenceTypeSlugToSpanishPublicLabel("testimonials").toLowerCase()).toContain(
      "testimonio",
    );
  });
});

describe("formatEvidenceTypeSlugsForUserFacingSummary", () => {
  it("joins two mapped labels without raw slugs", () => {
    const s = formatEvidenceTypeSlugsForUserFacingSummary(["experience", "metrics"]);
    expect(s.toLowerCase()).toMatch(/y /);
    expect(s).not.toMatch(/\bexperience\b|\bmetrics\b/i);
  });
});
