import { describe, expect, it } from "vitest";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import type { ResolveConversationDirectorInput } from "@/lib/brainstormer/conversation-director/types";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const emptySignals: ResolveConversationDirectorInput["brand_signals"] = {
  identity_or_positioning: ["Estratega de marketing con autoridad narrativa"],
  audiences: ["Profesionales de marketing en Colombia"],
  offer_or_roles: ["Consultoría", "Conferencias"],
  differentiators: ["Storytelling empresarial"],
  credibility_assets: ["Pópuli", "Perrenque"],
  tone_or_limbic_cues: ["Tono directo"],
  guardrails: ["Evitar promesas garantizadas"],
};

function baseInput(
  user_message: string,
  overrides?: Partial<ResolveConversationDirectorInput>,
): ResolveConversationDirectorInput {
  const progress = emptyBrainstormerSessionProgress();
  return {
    user_message,
    conversation_excerpt: `user: ${user_message}`,
    session_progress: {
      session_summary: progress.session_summary,
      current_challenge: progress.current_challenge,
      preliminary_objective: progress.preliminary_objective,
      project_readiness: progress.project_readiness,
      should_suggest_project_conversion: progress.should_suggest_project_conversion,
    },
    brand_signals: emptySignals,
    user_message_count: 1,
    ...overrides,
  };
}

describe("resolveConversationDirector — BRAIN-6 casos", () => {
  it("1. posicionamiento: hipótesis + pregunta de priorización", () => {
    const d = resolveConversationDirector(
      baseInput("Quiero mejorar mi posicionamiento"),
    );
    expect(d.challenge_type).toBe("positioning");
    expect(d.user_intent).toBe("explore");
    expect(d.conversation_stage).toBe("opening");
    expect(d.assistant_move).toBe("give_hypothesis_then_question");
    expect(d.next_best_question).toMatch(/consultoría|conferencias|autoridad pública/i);
    expect(d.question_id).toBe("positioning-opening-perception-priority");
    expect(d.question_asks_for).toBe("perception_priority");
    expect(d.question_reason.length).toBeGreaterThan(10);
    expect(d.should_use_web_search).toBe(false);
  });

  it("2. vender boletas: ventas + pregunta operativa", () => {
    const d = resolveConversationDirector(baseInput("Necesito vender boletas"));
    expect(d.challenge_type).toBe("sales");
    expect(d.user_intent).toBe("ask_how");
    expect(d.conversation_stage).toBe("opening");
    expect(d.assistant_move).toBe("ask_one_strategic_question");
    expect(d.next_best_question).toMatch(/boletas|tiempo queda/i);
    expect(d.question_id).toBe("sales-opening-sales-gap");
    expect(d.question_asks_for).toBe("sales_gap");
  });

  it("3. campaña: tipo campaña + planificación", () => {
    const d = resolveConversationDirector(
      baseInput("Necesito armar una campaña de lanzamiento"),
    );
    expect(d.challenge_type).toBe("campaign");
    expect(d.assistant_move).toBe("ask_one_strategic_question");
    expect(d.next_best_question).toMatch(/objetivo principal de la campaña/i);
  });

  it("4. contenido: editorial + canal", () => {
    const d = resolveConversationDirector(
      baseInput("Quiero mejorar mi contenido en redes"),
    );
    expect(d.challenge_type).toBe("content");
    expect(d.next_best_question).toMatch(/canal|frecuencia/i);
  });

  it("5. activación: experiencia memorable", () => {
    const d = resolveConversationDirector(
      baseInput("Necesito una activación presencial para el evento"),
    );
    expect(d.challenge_type).toBe("activation");
    expect(d.next_best_question).toMatch(/experiencia|recuerde/i);
  });

  it("6. usuario corrige al asistente: reparar y reencuadrar", () => {
    const d = resolveConversationDirector(
      baseInput("Eso ya está en la base, ya deberías saberlo"),
    );
    expect(d.user_intent).toBe("correct_assistant");
    expect(d.assistant_move).toBe("repair_and_reframe");
    expect(d.next_best_question).toMatch(/priorizamos/i);
  });

  it("7. usuario pide investigar: research + flag web (sin ejecutar)", () => {
    const d = resolveConversationDirector(
      baseInput("Investiga qué están haciendo otros eventos"),
    );
    expect(d.challenge_type).toBe("event_promotion");
    expect(d.user_intent).toBe("ask_for_research");
    expect(d.assistant_move).toBe("suggest_research");
    expect(d.should_use_web_search).toBe(true);
    expect(d.web_search_reason).toMatch(/benchmarking externo reciente/i);
  });

  it("8. usuario dice ok: intención unclear, avanza con una pregunta", () => {
    const progress = emptyBrainstormerSessionProgress();
    progress.current_challenge = "Mejorar posicionamiento de la marca";
    const d = resolveConversationDirector(
      baseInput("ok", {
        session_progress: {
          session_summary: "Explorando posicionamiento",
          current_challenge: progress.current_challenge,
          preliminary_objective: "",
          project_readiness: "low",
          should_suggest_project_conversion: false,
        },
        user_message_count: 4,
      }),
    );
    expect(d.user_intent).toBe("unclear");
    expect(d.assistant_move).toBe("ask_one_strategic_question");
    expect(d.next_best_question.length).toBeGreaterThan(10);
  });

  it("9. usuario pide convertir en proyecto: seed + alta readiness", () => {
    const d = resolveConversationDirector(
      baseInput("Conviértelo en proyecto"),
    );
    expect(d.user_intent).toBe("wants_project");
    expect(d.assistant_move).toBe("suggest_project_seed");
    expect(d.should_suggest_project_conversion).toBe(true);
    expect(d.project_readiness).toBe("high");
  });
});

describe("resolveConversationDirector — known / missing desde base", () => {
  it("incluye señales de marca conocidas para posicionamiento", () => {
    const d = resolveConversationDirector(
      baseInput("Quiero mejorar mi posicionamiento"),
    );
    expect(d.known_from_brand_base.length).toBeGreaterThan(0);
    expect(d.known_from_brand_base.some((k) => /Identidad|Diferenciadores|credibilidad/i.test(k))).toBe(
      true,
    );
    expect(d.missing_information.length).toBeGreaterThan(0);
  });
});
