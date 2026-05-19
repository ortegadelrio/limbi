import { describe, expect, it } from "vitest";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import {
  detectDeliverableType,
  detectWorkModeAndTransition,
  detectWorldCupIpGuardrail,
} from "@/lib/brainstormer/conversation-director/detect-work-mode-and-transition";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const MUNDIAL_LANDING_EXCERPT = `
user: Quiero mejorar mi posicionamiento de marca personal
assistant: Mi hipótesis es que tu territorio fuerte es autoridad narrativa...
user: Quiero enfocarme en vender consultorías
assistant: Prioricemos consultoría B2B con evidencia de la base...
user: Estoy pensando en una landing para vender una conferencia de liderazgo y trabajo en equipo inspirada en fútbol durante el Mundial 2026, para CEOs del Caribe colombiano
assistant: Tiene sentido anclar la conferencia en liderazgo...
user: Tengo los temas en un Word, ¿me ayudas a construir la landing y luego a planear la pauta?
`.trim();

describe("detectWorldCupIpGuardrail", () => {
  it("detecta riesgo de IP del Mundial", () => {
    expect(detectWorldCupIpGuardrail("landing para el Mundial 2026")).toBe(true);
    expect(detectWorldCupIpGuardrail("evento de liderazgo")).toBe(false);
  });
});

describe("detectDeliverableType", () => {
  it("detecta landing y pauta en el corpus", () => {
    expect(detectDeliverableType("necesito una landing page").type).toBe("landing_page");
    expect(detectDeliverableType("planear la pauta en meta").type).toBe("paid_media_plan");
  });
});

describe("detectWorkModeAndTransition — caso real Mundial + landing + Word", () => {
  const progress = emptyBrainstormerSessionProgress();
  progress.current_challenge = "Vender conferencia vía landing";
  progress.preliminary_objective = "Landing + pauta para CEOs Caribe";

  it("activa project_seed o deliverable_building con entregables concretos", () => {
    const r = detectWorkModeAndTransition({
      user_message:
        "Tengo los temas en un Word, ¿me ayudas a construir la landing y luego a planear la pauta?",
      conversation_excerpt: MUNDIAL_LANDING_EXCERPT,
      user_intent: "ask_how",
      challenge_type: "sales",
      session_progress: {
        session_summary: progress.session_summary,
        current_challenge: progress.current_challenge,
        preliminary_objective: progress.preliminary_objective,
        project_readiness: "medium",
        should_suggest_project_conversion: false,
      },
    });

    expect(r.concrete_deliverable_detected).toBe(true);
    expect(r.multi_deliverable_project_shape).toBe(true);
    expect(["project_seed", "deliverable_building"]).toContain(r.work_mode);
    expect(r.world_cup_ip_guardrail).toBe(true);
    expect(r.should_request_user_material).toBe(true);
    expect(r.requested_material_reason).toMatch(/Word|archivo/i);
    expect(r.transition_message).toMatch(/proyecto|landing|posicionamiento/i);
    expect(r.transition_message).toMatch(/Word|terceros|oficial|licenciada/i);
  });
});

describe("resolveConversationDirector — integración BRAIN-9", () => {
  it("último turno del caso Mundial: pide material y no sugiere copy final", () => {
    const progress = emptyBrainstormerSessionProgress();
    progress.current_challenge = "Landing conferencia liderazgo y fútbol";
    progress.session_summary = "De posicionamiento a venta de conferencia";

    const d = resolveConversationDirector({
      user_message:
        "Tengo los temas en un Word, ¿me ayudas a construir la landing y luego a planear la pauta?",
      conversation_excerpt: MUNDIAL_LANDING_EXCERPT,
      session_progress: {
        session_summary: progress.session_summary,
        current_challenge: progress.current_challenge,
        preliminary_objective: "Landing + pauta",
        project_readiness: "medium",
        should_suggest_project_conversion: false,
      },
      brand_signals: {
        identity_or_positioning: ["Autoridad en marketing"],
        audiences: ["CEOs"],
        offer_or_roles: ["Consultoría", "Conferencias"],
        differentiators: [],
        credibility_assets: [],
        tone_or_limbic_cues: [],
        guardrails: [],
      },
      user_message_count: 5,
    });

    expect(d.concrete_deliverable_detected).toBe(true);
    expect(d.should_request_user_material).toBe(true);
    expect(d.next_best_question).toMatch(/Word|pegar|subir/i);
    expect(d.question_id).toBe("brain9-request-user-material");
    expect(d.world_cup_ip_guardrail).toBe(true);
    expect(d.transition_message).toBeTruthy();
    expect(d.should_suggest_project_conversion).toBe(true);
    expect(d.project_readiness).toBe("high");
  });
});
