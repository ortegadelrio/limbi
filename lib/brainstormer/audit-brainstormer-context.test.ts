import { describe, expect, it, vi, afterEach } from "vitest";
import { isBrainstormerDebugContextEnabled } from "@/lib/brainstormer/audit-brainstormer-context";
import {
  extractDetectedBrandSignalsFromPayloads,
  formatBrandSignalsFromActiveBaseBlock,
} from "@/lib/brainstormer/brand-signals-from-active-base";
import { buildBrainstormerOpenAIInput } from "@/lib/brainstormer/build-brainstormer-openai-input";
import { BRAINSTORMER_KNOWLEDGE_PROMPT_MAX_CHARS } from "@/lib/brainstormer/brainstormer-prompt-limits";
import { truncateForBrainstormerPrompt } from "@/lib/brainstormer/brainstormer-prompt-limits";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

describe("isBrainstormerDebugContextEnabled", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("en production solo con BRAINSTORMER_DEBUG_CONTEXT=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BRAINSTORMER_DEBUG_CONTEXT", undefined);
    expect(isBrainstormerDebugContextEnabled()).toBe(false);
    vi.stubEnv("BRAINSTORMER_DEBUG_CONTEXT", "true");
    expect(isBrainstormerDebugContextEnabled()).toBe(true);
  });

  it("fuera de production habilitado salvo BRAINSTORMER_DEBUG_CONTEXT=false", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BRAINSTORMER_DEBUG_CONTEXT", undefined);
    expect(isBrainstormerDebugContextEnabled()).toBe(true);
    vi.stubEnv("BRAINSTORMER_DEBUG_CONTEXT", "false");
    expect(isBrainstormerDebugContextEnabled()).toBe(false);
  });
});

describe("extractDetectedBrandSignalsFromPayloads", () => {
  const sampleKnowledge = {
    executive_reading: "Storyteller y líder de industria creativa.",
    section_interpretations: [
      {
        section_key: "audiences",
        headline: "Profesionales de marketing",
        interpretation: "Segmento principal en Colombia y LATAM.",
      },
      {
        section_key: "value_proposition",
        headline: "Propuesta",
        interpretation: "Narrativa estratégica con credibilidad empresarial.",
      },
      {
        section_key: "differentiators",
        headline: "Diferenciadores",
        interpretation: "Perrenque, opinión pública y ecosistema creativo.",
      },
    ],
    offer_architecture: {
      offer_summary: "Conferencias y consultoría.",
      service_catalog: [{ name: "Perrenque", item_type: "event", description: "x" }],
    },
    restrictions_and_alerts: "Evitar promesas de resultados garantizados.",
    credibility_architecture: {
      authority_signals: ["Columnista"],
      institutional_roles: [],
      industry_leadership_assets: [],
      founder_credentials: [],
      business_ecosystem: ["Perrenque"],
      reputation_proof_points: [],
      communication_use_guidance: "Usar con criterio.",
      cautions: [],
    },
  };

  it("extrae audiencias, oferta y diferenciadores del payload consolidado", () => {
    const s = extractDetectedBrandSignalsFromPayloads(sampleKnowledge, {
      symbolic_reading: "Energía alta, tono directo.",
    });
    expect(s.audiences.length).toBeGreaterThan(0);
    expect(s.offer_or_roles.some((x) => x.includes("Perrenque"))).toBe(true);
    expect(s.differentiators.some((x) => x.includes("Perrenque"))).toBe(true);
    expect(s.guardrails.length).toBeGreaterThan(0);
    expect(s.tone_or_limbic_cues.length).toBeGreaterThan(0);
  });
});

describe("formatBrandSignalsFromActiveBaseBlock", () => {
  it("incluye encabezado BRAND_SIGNALS_FROM_ACTIVE_BASE y secciones", () => {
    const block = formatBrandSignalsFromActiveBaseBlock({
      identity_or_positioning: ["Storyteller"],
      audiences: ["Marketing LATAM"],
      offer_or_roles: ["Perrenque"],
      differentiators: ["Ecosistema creativo"],
      credibility_assets: ["Columnista"],
      tone_or_limbic_cues: ["Tono directo"],
      guardrails: ["Sin promesas garantizadas"],
    });
    expect(block).toContain("BRAND_SIGNALS_FROM_ACTIVE_BASE");
    expect(block).toContain("Possible positioning territories");
    expect(block).toContain("Oferta / roles comerciales");
    expect(block).toContain("Storyteller");
    expect(block).toContain("Perrenque");
    expect(block).toMatch(/Antes de responder/i);
  });
});

describe("buildBrainstormerOpenAIInput / truncado", () => {
  it("marca truncado cuando el knowledge JSON supera el límite del prompt", () => {
    const huge = { blob: "x".repeat(BRAINSTORMER_KNOWLEDGE_PROMPT_MAX_CHARS + 500) };
    const t = truncateForBrainstormerPrompt(huge, BRAINSTORMER_KNOWLEDGE_PROMPT_MAX_CHARS);
    expect(t.truncated).toBe(true);
    expect(t.text).toContain("truncado");

    const progress = emptyBrainstormerSessionProgress();
    const conversation_director = resolveConversationDirector({
      user_message: "hola",
      conversation_excerpt: "user: hola",
      session_progress: {
        session_summary: progress.session_summary,
        current_challenge: progress.current_challenge,
        preliminary_objective: progress.preliminary_objective,
        project_readiness: progress.project_readiness,
        should_suggest_project_conversion: progress.should_suggest_project_conversion,
      },
      brand_signals: {
        identity_or_positioning: [],
        audiences: [],
        offer_or_roles: [],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 1,
    });

    const built = buildBrainstormerOpenAIInput({
      brand_name: "Ortegadelrio",
      session_title: "Test",
      brand_context_status: "ready",
      brand_context_has_pending_updates: false,
      brand_context_blocking_reasons: [],
      session_summary_progress: progress,
      conversation_excerpt: "user: hola",
      conversation_director,
      knowledge_payload: huge,
      limbic_payload: { symbolic_reading: "ok" },
    });
    expect(built.knowledge_truncated_in_prompt).toBe(true);
    expect(built.full_input).toContain("BRAND_SIGNALS_FROM_ACTIVE_BASE");
    expect(built.full_input).toContain("FROZEN_ACTIVE_KNOWLEDGE_BASE_JSON");
    const signalsIdx = built.full_input.indexOf("BRAND_SIGNALS_FROM_ACTIVE_BASE");
    const knowledgeIdx = built.full_input.indexOf(
      "FROZEN_ACTIVE_KNOWLEDGE_BASE_JSON (deep consolidated_payload",
      signalsIdx,
    );
    const limbicIdx = built.full_input.indexOf(
      "FROZEN_ACTIVE_LIMBIC_BASE_JSON (deep consolidated_payload",
      knowledgeIdx,
    );
    const userIdx = built.full_input.indexOf("SESSION METADATA", limbicIdx);
    expect(signalsIdx).toBeGreaterThan(-1);
    expect(knowledgeIdx).toBeGreaterThan(signalsIdx);
    expect(limbicIdx).toBeGreaterThan(knowledgeIdx);
    expect(userIdx).toBeGreaterThan(limbicIdx);
    expect(built.full_input).toContain("CONVERSATION_DIRECTION");
  });
});
