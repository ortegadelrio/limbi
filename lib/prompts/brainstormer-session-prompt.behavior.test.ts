import { describe, expect, it } from "vitest";
import { BRAINSTORMER_CORE_BEHAVIOR_ES } from "@/lib/brainstormer/brainstormer-core-behavior";
import { buildConversationalRendererSystemInstructions } from "@/lib/brainstormer/conversational-renderer";
import {
  derivePossiblePositioningTerritories,
  extractDetectedBrandSignalsFromPayloads,
  formatBrandSignalsFromActiveBaseBlock,
} from "@/lib/brainstormer/brand-signals-from-active-base";

describe("Brainstormer prompt v3 — core + renderer slim", () => {
  const renderer = () => buildConversationalRendererSystemInstructions();

  it("versión del prompt", () => {
    expect(renderer()).toContain("brainstormer-session-v3.0");
    expect(renderer()).toContain("conversational-renderer-v6-natural");
  });

  it("core behavior: creativo senior, no asistente genérico", () => {
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/creativo estratégico senior/i);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/Toma postura|No lo cambiaría/i);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/qué opinas/i);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/familia genérica de descubrimiento/i);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).not.toMatch(/Descubre lo inesperado/i);
  });

  it("renderer no re-decide estrategia", () => {
    const s = renderer();
    expect(s).toMatch(/do not re-decide strategy/i);
    expect(s).toMatch(/CONVERSATION_DIRECTION|compact/i);
    expect(s).toMatch(/THIS TURN/i);
    expect(s).toMatch(/Closing question only when/i);
  });

  it("renderer delega borrador y material al director compacto", () => {
    const s = renderer();
    expect(s).toMatch(/should_generate_content_now/i);
    expect(s).toMatch(/user_has_no_material/i);
    expect(s).toMatch(/150–280/);
  });

  it("renderer incluye guardrail IP terceros", () => {
    expect(renderer()).toMatch(/third-party official IP/i);
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
        interpretation: "Metodología propia.",
      },
    ],
    offer_architecture: { services: [{ name: "Consultoría" }] },
    evidence_base: [{ type: "case", label: "Caso X" }],
    guardrails: { avoid: ["jerga vacía"] },
  };

  it("formatea señales detectadas sin inventar campos", () => {
    const signals = extractDetectedBrandSignalsFromPayloads(sampleKnowledge, {
      symbolic_reading: "Calidez estratégica",
    });
    const block = formatBrandSignalsFromActiveBaseBlock(signals, sampleKnowledge);
    expect(block).toContain("BRAND_SIGNALS_FROM_ACTIVE_BASE");
    expect(block).toMatch(/Profesionales|Metodología/i);
  });

  it("derivePossiblePositioningTerritories devuelve territorios cuando hay señales", () => {
    const signals = extractDetectedBrandSignalsFromPayloads(sampleKnowledge, null);
    const territories = derivePossiblePositioningTerritories(signals);
    expect(territories.length).toBeGreaterThan(0);
  });
});
