import { describe, expect, it } from "vitest";
import { buildBrainstormerSessionSystemInstructions } from "@/lib/prompts/brainstormer-session";
import {
  derivePossiblePositioningTerritories,
  extractDetectedBrandSignalsFromPayloads,
  formatBrandSignalsFromActiveBaseBlock,
} from "@/lib/brainstormer/brand-signals-from-active-base";

describe("Brainstormer session prompt (v1.5 — hipótesis en posicionamiento)", () => {
  const p = () => buildBrainstormerSessionSystemInstructions();

  it("versión del prompt", () => {
    expect(p()).toContain("brainstormer-session-v1.5");
  });

  it("Positioning requires a strategic hypothesis before asking", () => {
    const s = p();
    expect(s).toMatch(/Positioning requires a strategic hypothesis BEFORE asking/i);
    expect(s).toMatch(/STRATEGIC HYPOTHESIS BEFORE ASKING/i);
    expect(s).toMatch(/Mi hipótesis es que|State your hypothesis explicitly/i);
  });

  it("Do not only present options", () => {
    const s = p();
    expect(s).toMatch(/Do not only present options/i);
    expect(s).toMatch(/Do NOT open with only|menu of formats|multiple-choice menu/i);
  });

  it("Use named credibility assets as evidence when available", () => {
    const s = p();
    expect(s).toMatch(/named assets|concrete named assets|Pópuli|credibility EVIDENCE/i);
  });

  it("Distinguish positioning territory from service format", () => {
    const s = p();
    expect(s).toMatch(/distinguish territory from service format|formats\/offers|territorio.*formato/i);
  });

  it("Ask one validation question after the hypothesis", () => {
    const s = p();
    expect(s).toMatch(/ONE validation|prioritization question.*after the hypothesis|after the hypothesis, not instead/i);
  });

  it("ejemplo hipótesis autoridad narrativa con activos", () => {
    const s = p();
    expect(s).toMatch(/autoridad narrativa|Mi hipótesis es que tu posicionamiento no debería partir por formato/i);
    expect(s).toMatch(/Pópuli|Perrenque|COMARKA|UNEMEC/);
  });

  it("mantiene reglas v1.4 (intent-sensitive + brevedad)", () => {
    const s = p();
    expect(s).toMatch(/INTENT-SENSITIVE/i);
    expect(s).toMatch(/60[\s–-]+140/i);
    expect(s).toMatch(/At most ONE strategic question/i);
  });
});

describe("formatBrandSignalsFromActiveBaseBlock", () => {
  const sampleKnowledge = {
    executive_reading: "Estratega de marketing y storyteller empresarial con trayectoria en industria creativa.",
    section_interpretations: [
      {
        section_key: "audiences",
        headline: "Profesionales",
        interpretation: "Marketing y comunicación en Colombia.",
      },
      {
        section_key: "differentiators",
        headline: "Diferenciación",
        interpretation: "Integración de servicios, innovación y reputación.",
      },
    ],
    offer_architecture: {
      offer_summary: "Consultoría y conferencias.",
      service_catalog: [
        { name: "Perrenque", item_type: "event" },
        { name: "Consultoría estratégica", item_type: "service" },
      ],
    },
    credibility_architecture: {
      authority_signals: ["Más de 20 años de experiencia"],
      institutional_roles: ["COMARKA", "UNEMEC"],
      industry_leadership_assets: [],
      founder_credentials: [],
      business_ecosystem: ["Pópuli", "2HPRO"],
      reputation_proof_points: ["Reputación en sector"],
      communication_use_guidance: "x",
      cautions: [],
    },
    restrictions_and_alerts: "Evitar dispersión de mensajes.",
  };

  it("incluye Possible positioning territories separado de oferta comercial", () => {
    const signals = extractDetectedBrandSignalsFromPayloads(sampleKnowledge, {
      symbolic_reading: "Autoridad y energía alta.",
    });
    const block = formatBrandSignalsFromActiveBaseBlock(signals, sampleKnowledge);
    expect(block).toContain("Possible positioning territories");
    expect(block).toContain("Oferta / roles comerciales");
    expect(block).toMatch(/hipótesis estratégica|menú de opciones/i);
    const territories = derivePossiblePositioningTerritories(signals, sampleKnowledge);
    expect(territories.some((t) => /storyteller|estratega|industria creativa/i.test(t))).toBe(true);
  });
});
