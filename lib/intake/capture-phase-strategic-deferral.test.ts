import { describe, expect, it } from "vitest";
import {
  buildCapturePhaseStrategicDeferralInterviewerMessage,
  extractIdentifiedActorLabelsFromUserText,
} from "@/lib/intake/capture-phase-strategic-deferral";
import { initialTrace } from "@/lib/intake/orchestrator";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine/resolve-guided-intake-turn";

describe("buildCapturePhaseStrategicDeferralInterviewerMessage", () => {
  it("gives guided orientation without a final recommendation", () => {
    const msg = buildCapturePhaseStrategicDeferralInterviewerMessage({
      userText: "¿A quién me recomiendas?",
    });
    expect(msg).toMatch(/^Puedo orientarte/i);
    expect(msg).toMatch(/orientarte|orientar/i);
    expect(msg).toMatch(/diagn[oó]stico/i);
    expect(msg).toMatch(/quién compra|quién usa|autoriza/i);
    expect(msg).not.toMatch(/mi recomendaci[oó]n es priorizar/i);
  });

  it("summarizes named actors as identified, not final priority", () => {
    const msg = buildCapturePhaseStrategicDeferralInterviewerMessage({
      userText: "¿A quién me recomiendas? Tengo colegios, padres y estudiantes.",
    });
    expect(msg).toMatch(/Hasta ahora aparecen/i);
    expect(msg).toMatch(/colegios/i);
    expect(msg).toMatch(/padres/i);
    expect(msg).toMatch(/estudiantes/i);
    expect(msg).toMatch(/actores identificados/i);
    expect(msg).toMatch(/prioridad.*diagn[oó]stico/i);
    expect(msg).not.toMatch(/mi recomendaci[oó]n es priorizar/i);
  });
});

describe("extractIdentifiedActorLabelsFromUserText", () => {
  it("dedupes and orders by first hit", () => {
    const labels = extractIdentifiedActorLabelsFromUserText(
      "Padres y colegios; luego estudiantes.",
    );
    expect(labels).toEqual(["padres", "colegios", "estudiantes"]);
  });
});

describe("resolveGuidedIntakeTurn capture-first", () => {
  it("routes recommendation-style asks on main phase to deferral, not strategic validation", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "¿A quién me recomiendas?",
      miniStep: "audience",
      trace: { ...initialTrace(), phase: "main", mini_step: "audience", turns: [] },
    });
    expect(d.notes_for_route.branch).toBe("capture_phase_strategic_deferral");
    expect(d.user_intent).toBe("clarification_question");
    expect(d.next_phase).toBe("main");
    expect(d.requires_confirmation).toBe(false);
  });

  it("keeps deterministic strategic validation when already in strategy_validation phase", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "¿Crees que tiene sentido priorizar el foco operativo antes que el comercial?",
      miniStep: "audience",
      trace: {
        ...initialTrace(),
        phase: "strategy_validation",
        mini_step: "audience",
        turns: [],
      },
    });
    expect(d.notes_for_route.branch).toBe("deterministic_strategic_validation");
    expect(d.requires_confirmation).toBe(true);
  });
});
