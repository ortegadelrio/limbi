import { describe, expect, it } from "vitest";
import {
  confirmedStrategicActorContext,
  extractActorsForAudienceRecommendation,
  isAudienceGuidanceSeekingTurn,
} from "@/lib/intake/guided-intake-multi-actor-audience";
import { buildStrategicValidationTurnContent } from "@/lib/intake/guided-intake-strategic-validation";

const CONFIRMED_STRATEGIC = {
  simple_description: "",
  problem_description_optional:
    "La fricción central es que los padres necesitan confiar en el operador antes de autorizar.",
};

describe("isAudienceGuidanceSeekingTurn", () => {
  it("treats Spanish hedged recommendation + doubt as guidance-seeking", () => {
    expect(
      isAudienceGuidanceSeekingTurn(
        "Yo diria que a los niños, pero recomiéndame porque tengo dudas",
      ),
    ).toBe(true);
  });
});

describe("extractActorsForAudienceRecommendation (guidance + confirmed narrative)", () => {
  it("does not treat recommendation tails, doubt, or full hedged clauses as actor labels", () => {
    const userLine = "Yo diria que a los niños, pero recomiéndame porque tengo dudas";
    const source = `${userLine}\n${confirmedStrategicActorContext(CONFIRMED_STRATEGIC)}`;
    const blobLower = `${source}\n`.toLowerCase();
    const { clean, ambiguous } = extractActorsForAudienceRecommendation(source, blobLower);
    expect(ambiguous.length).toBe(0);
    expect(clean.some((a) => /\brecomi/i.test(a.label))).toBe(false);
    expect(clean.some((a) => /dudas/i.test(a.label))).toBe(false);
    expect(clean.some((a) => /\bpero\b/i.test(a.label))).toBe(false);
    expect(clean.some((a) => /dir[ií]a/i.test(a.label))).toBe(false);
    expect(clean.some((a) => /^niños$/i.test(a.label.trim()))).toBe(true);
    expect(clean.some((a) => /padres/i.test(a.label))).toBe(true);
  });
});

describe("extractActorsForAudienceRecommendation (salud-style trace)", () => {
  it("extracts three institution/person actors from a single trace line", () => {
    const trace =
      "Los pacientes usan el servicio, pero los médicos lo recomiendan y las aseguradoras autorizan.";
    const source = `${trace}\n¿Qué priorizarías?`;
    const blobLower = `${source}\nplataforma clínica`.toLowerCase();
    const { clean, ambiguous } = extractActorsForAudienceRecommendation(source, blobLower);
    expect(ambiguous.length).toBe(0);
    expect(clean.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildStrategicValidationTurnContent audience guidance", () => {
  it("orders by authorizer vs experiencer signals from confirmed text and requires confirmation before pending merge", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "Yo diria que a los niños, pero recomiéndame porque tengo dudas",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: CONFIRMED_STRATEGIC,
      traceUserTurns: [],
    });
    expect(content.audience_recommendation_pending).not.toBeNull();
    expect(content.interviewer_message).toMatch(/¿Confirmas/i);
    const p = content.audience_recommendation_pending!;
    expect(p.primary_label).not.toMatch(/recomi|dudas|pero|dir[ií]a/i);
    expect(p.secondary_label).not.toMatch(/recomi|dudas|pero|dir[ií]a/i);
    expect(`${p.primary_label} ${p.secondary_label}`.toLowerCase()).toMatch(/padres/);
    expect(`${p.primary_label} ${p.secondary_label}`.toLowerCase()).toMatch(/niños/);
    expect(content.interviewer_message.toLowerCase()).toMatch(/autoriz|confianza|pago/);
    expect(content.interviewer_message.toLowerCase()).toMatch(/deseo|vivencia|uso/);
  });
});
