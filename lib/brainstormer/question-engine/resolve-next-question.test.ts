import { describe, expect, it } from "vitest";
import { resolveNextQuestion } from "@/lib/brainstormer/question-engine/resolve-next-question";
import type { ResolveNextQuestionInput } from "@/lib/brainstormer/question-engine/types";

function baseInput(
  overrides: Partial<ResolveNextQuestionInput> = {},
): ResolveNextQuestionInput {
  return {
    challenge_type: "unknown",
    user_intent: "explore",
    conversation_stage: "opening",
    assistant_move: "ask_one_strategic_question",
    known_from_brand_base: [],
    missing_information: [],
    session_progress: {
      session_summary: "",
      current_challenge: "",
      preliminary_objective: "",
    },
    ...overrides,
  };
}

describe("resolveNextQuestion — selección por reto", () => {
  it("posicionamiento en apertura: prioridad de percepción", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "positioning",
        conversation_stage: "opening",
        assistant_move: "give_hypothesis_then_question",
        missing_information: [
          "Prioridad del posicionamiento (venta vs autoridad vs visibilidad pública)",
        ],
      }),
    );
    expect(r.candidate_id).toBe("positioning-opening-perception-priority");
    expect(r.asks_for).toBe("perception_priority");
    expect(r.question).toMatch(/consultoría|conferencias|autoridad pública/i);
  });

  it("ventas ask_how: gap de boletas", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "sales",
        user_intent: "ask_how",
        missing_information: ["Meta de ventas / boletas", "Plazo"],
      }),
    );
    expect(r.candidate_id).toBe("sales-opening-sales-gap");
    expect(r.question).toMatch(/boletas|tiempo queda/i);
    expect(r.reason.length).toBeGreaterThan(20);
    expect(r.reason).toMatch(/meta faltante|plazo|tácticas/i);
  });

  it("campaña: objetivo y plazo", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "campaign",
        missing_information: ["Objetivo de campaña", "Plazo de lanzamiento"],
      }),
    );
    expect(r.candidate_id).toBe("campaign-opening-objective");
    expect(r.question).toMatch(/objetivo principal de la campaña/i);
  });

  it("contenido: canal y frecuencia", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "content",
        missing_information: ["Canal prioritario", "Frecuencia / cadencia"],
      }),
    );
    expect(r.candidate_id).toBe("content-opening-channels");
    expect(r.question).toMatch(/canal|frecuencia/i);
  });

  it("activación: experiencia memorable", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "activation",
        missing_information: ["Tipo de experiencia"],
      }),
    );
    expect(r.candidate_id).toBe("activation-opening-context");
    expect(r.question).toMatch(/experiencia|recuerde/i);
  });
});

describe("resolveNextQuestion — movimientos del director", () => {
  it("repair_and_reframe: priorizar con la base", () => {
    const r = resolveNextQuestion(
      baseInput({
        assistant_move: "repair_and_reframe",
        user_intent: "correct_assistant",
      }),
    );
    expect(r.candidate_id).toBe("cross-repair-prioritize");
    expect(r.question).toMatch(/priorizamos/i);
  });

  it("suggest_research en eventos: referentes externos", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "event_promotion",
        assistant_move: "suggest_research",
        user_intent: "ask_for_research",
        missing_information: ["Criterios de benchmark (competidores, geografía, periodo)"],
      }),
    );
    expect(r.candidate_id).toBe("cross-research-event-references");
    expect(r.question).toMatch(/eventos|competidores/i);
  });

  it("suggest_project_seed: tipo de proyecto", () => {
    const r = resolveNextQuestion(
      baseInput({
        assistant_move: "suggest_project_seed",
        user_intent: "wants_project",
        conversation_stage: "ready_for_project_seed",
      }),
    );
    expect(r.candidate_id).toBe("cross-project-seed-type");
  });

  it("usuario unclear con reto activo: continuar o cambiar foco", () => {
    const r = resolveNextQuestion(
      baseInput({
        user_intent: "unclear",
        conversation_stage: "focusing",
        session_progress: {
          session_summary: "Explorando",
          current_challenge: "Mejorar posicionamiento",
          preliminary_objective: "",
        },
      }),
    );
    expect(r.candidate_id).toBe("cross-unclear-continue-challenge");
  });
});

describe("resolveNextQuestion — avoid_if_known", () => {
  it("evita pregunta de audiencia si ya está en known_from_brand_base", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "sales",
        conversation_stage: "exploration",
        known_from_brand_base: ["Audiencias: Profesionales de marketing en Colombia"],
        missing_information: ["Canal principal de conversión"],
      }),
    );
    expect(r.candidate_id).not.toBe("sales-exploration-audience");
    expect(r.candidate_id).toBe("sales-exploration-channels");
    expect(r.asks_for).toBe("channels");
  });

  it("evita perception_priority si prioridad ya conocida", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "positioning",
        conversation_stage: "opening",
        assistant_move: "give_hypothesis_then_question",
        known_from_brand_base: [
          "Prioridad del posicionamiento: venta de consultoría",
        ],
        missing_information: ["Horizonte temporal del reto"],
      }),
    );
    expect(r.candidate_id).not.toBe("positioning-opening-perception-priority");
    expect(["positioning-opening-positioning-goal", "positioning-structuring-deadline"]).toContain(
      r.candidate_id,
    );
  });
});

describe("resolveNextQuestion — etapa de conversación", () => {
  it("structuring de campaña prioriza deadline sobre objective de opening", () => {
    const r = resolveNextQuestion(
      baseInput({
        challenge_type: "campaign",
        conversation_stage: "structuring",
        missing_information: ["Plazo de lanzamiento"],
        session_progress: {
          session_summary: "Campaña de lanzamiento Q3",
          current_challenge: "Lanzar producto",
          preliminary_objective: "Awareness + leads",
        },
      }),
    );
    expect(r.candidate_id).toBe("campaign-structuring-deadline");
  });
});
