import { describe, expect, it } from "vitest";
import { buildConversationalRendererSystemInstructions } from "@/lib/brainstormer/conversational-renderer";
import {
  derivePossiblePositioningTerritories,
  extractDetectedBrandSignalsFromPayloads,
  formatBrandSignalsFromActiveBaseBlock,
} from "@/lib/brainstormer/brand-signals-from-active-base";

describe("Brainstormer Conversational Renderer prompt (v2.0 — BRAIN-12)", () => {
  const p = () => buildConversationalRendererSystemInstructions();

  it("versión del prompt", () => {
    expect(p()).toContain("brainstormer-session-v2.0");
    expect(p()).toContain("conversational-renderer-v4");
  });

  it("no re-decide estrategia: sigue CONVERSATION_DIRECTION", () => {
    const s = p();
    expect(s).toMatch(/do NOT choose challenge type|do NOT improvise a different conversational move/i);
    expect(s).toMatch(/next_best_question, question_id, question_asks_for, question_reason/i);
  });

  it("give_hypothesis_then_question: hipótesis antes de preguntar", () => {
    const s = p();
    expect(s).toMatch(/give_hypothesis_then_question/i);
    expect(s).toMatch(/Mi hipótesis es que|Hipótesis explícita/i);
    expect(s).toMatch(/No menú A\/B\/C sin hipótesis previa/i);
  });

  it("voz consultor: breve, sin informe", () => {
    const s = p();
    expect(s).toMatch(/60–140 words|consultor|sin informe/i);
    expect(s).toMatch(/At most ONE question/i);
  });

  it("prohíbe fillers de chatbot", () => {
    const s = p();
    expect(s).toMatch(/El reto que enfrentamos es claro/i);
  });

  it("BRAIN-9: work_mode y material antes de copy final", () => {
    const s = p();
    expect(s).toMatch(/work_mode/i);
    expect(s).toMatch(/deliverable_building/i);
    expect(s).toMatch(/should_request_user_material/i);
    expect(s).toMatch(/world_cup_ip_guardrail/i);
  });

  it("BRAIN-10: voz consultor y lenguaje débil prohibido", () => {
    const s = p();
    expect(s).toMatch(/consultor senior/i);
    expect(s).toMatch(/podrías/);
    expect(s).toMatch(/repair_confusion|no entendió/i);
    expect(s).toMatch(/typo_avoid_terms/i);
  });

  it("BRAIN-12: borrador de sección y sin pedir notas", () => {
    const s = p();
    expect(s).toMatch(/should_generate_content_now/i);
    expect(s).toMatch(/user_has_no_material/i);
    expect(s).toMatch(/150–280/);
    expect(s).toMatch(/FODA\/SWOT|profundizar/i);
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
