import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine";
import {
  buildSegmentConfirmationAssistantMessage,
  classifySegmentConfirmationUserReply,
  sanitizeInterpretationCoreForSegmentConfirmation,
} from "@/lib/intake/segment-confirmation";
import {
  extractionPayloadForTrace,
  miniStepRequiresSegmentConfirmationGate,
  shouldOfferSegmentConfirmationAfterExtraction,
} from "@/lib/intake/segment-confirmation-gate";
import { pilotSummaryBlockedByDecisionStates } from "@/lib/intake/decision-state";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import {
  mergeResponsesWithInterviewTrace,
  stripSegmentConfirmationPending,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";

function traceWithPending(
  pending: LimbicInterviewTraceV1["segment_confirmation_pending"],
): LimbicInterviewTraceV1 {
  return {
    version: 1,
    pilot_id: "strategic_interview_v1",
    phase: "segment_confirmation",
    follow_up_used: false,
    mini_step: "tailored_what",
    turns: [],
    segment_confirmation_pending: pending,
  };
}

function minimalExtraction(
  interviewer_message: string,
  internal_notes = "unit",
  extracted_response_updates: Record<string, unknown> = {},
): IntakeExtractionOutput {
  return {
    extracted_response_updates,
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "clear",
    target_response_paths: [],
    internal_notes,
    interviewer_message,
    public_copy_allowed: false,
    user_intent: "answer",
  };
}

describe("segment confirmation gate helpers", () => {
  it("gates interpreted free-form strategic steps but not closed-choice challenge_type", () => {
    expect(miniStepRequiresSegmentConfirmationGate("tailored_what")).toBe(true);
    expect(miniStepRequiresSegmentConfirmationGate("problem")).toBe(true);
    expect(miniStepRequiresSegmentConfirmationGate("challenge_type")).toBe(false);
    expect(miniStepRequiresSegmentConfirmationGate("complete")).toBe(false);
  });

  it("does not offer segment confirmation after extraction for challenge_type", () => {
    expect(
      shouldOfferSegmentConfirmationAfterExtraction({
        miniStep: "challenge_type",
        tracePhase: "main",
        needsFollowUp: false,
        followUpUsed: false,
      }),
    ).toBe(false);
  });

  it("offers segment confirmation for tailored_what and problem on main when not in follow-up", () => {
    for (const step of ["tailored_what", "problem"] as const) {
      expect(
        shouldOfferSegmentConfirmationAfterExtraction({
          miniStep: step,
          tracePhase: "main",
          needsFollowUp: false,
          followUpUsed: false,
        }),
      ).toBe(true);
    }
  });

  it("keeps segment confirmation for open-ended strategic mini steps", () => {
    expect(miniStepRequiresSegmentConfirmationGate("audience")).toBe(true);
    expect(
      shouldOfferSegmentConfirmationAfterExtraction({
        miniStep: "audience",
        tracePhase: "main",
        needsFollowUp: false,
        followUpUsed: false,
      }),
    ).toBe(true);
  });

  it("uses a stable internal_notes slug for challenge type picks, not segment-confirm markers", () => {
    const extraction = {
      ...minimalExtraction("Perfecto: vamos a trabajar un servicio."),
      internal_notes: "challenge_type_pick",
    };
    expect(extraction.internal_notes).toBe("challenge_type_pick");
    expect(extraction.internal_notes).not.toContain("segment_confirm:");
  });

  it("offers confirmation after extraction when advancing on same step without follow-up", () => {
    expect(
      shouldOfferSegmentConfirmationAfterExtraction({
        miniStep: "problem",
        tracePhase: "main",
        needsFollowUp: false,
        followUpUsed: false,
      }),
    ).toBe(true);
    expect(
      shouldOfferSegmentConfirmationAfterExtraction({
        miniStep: "problem",
        tracePhase: "main",
        needsFollowUp: true,
        followUpUsed: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferSegmentConfirmationAfterExtraction({
        miniStep: "problem",
        tracePhase: "follow_up",
        needsFollowUp: false,
        followUpUsed: true,
      }),
    ).toBe(true);
  });

  it("round-trips extraction for trace storage", () => {
    const e = minimalExtraction("síntesis interna");
    const rec = extractionPayloadForTrace(e);
    expect(rec.interviewer_message).toBe("síntesis interna");
  });

  it("builds shorter confirmation copy grounded in the interpreted line", () => {
    const msg = buildSegmentConfirmationAssistantMessage(
      minimalExtraction("interpretación resumida"),
    );
    expect(msg).toContain("Lo guardaría así:");
    expect(msg).toContain("interpretación resumida");
    expect(msg).toMatch(/ajustamos|pendiente/i);
  });

  it("prefers structured simple_description over interviewer_message for tailored_what", () => {
    const msg = buildSegmentConfirmationAssistantMessage(
      minimalExtraction(
        "Etapa crucial con oportunidades de personalización y potencial fuerte.",
        "unit",
        {
          strategic_base: {
            simple_description: "Un servicio de software para equipos medianos.",
          },
        },
      ),
      "tailored_what",
    );
    expect(msg).toMatch(/Ofreces/i);
    expect(msg).toMatch(/software|equipos/i);
    expect(msg).not.toMatch(/etapa crucial|potencial fuerte|oportunidades de personalizaci/i);
  });

  it("uses problem_description_optional for problem step, not interviewer prose", () => {
    const msg = buildSegmentConfirmationAssistantMessage(
      minimalExtraction(
        "Resuena con una etapa de vida distinta y hay alto potencial.",
        "unit",
        {
          strategic_base: {
            problem_description_optional: "La coordinación interna se rompe antes del lanzamiento.",
          },
        },
      ),
      "problem",
    );
    expect(msg).toMatch(/fricci[oó]n central/i);
    expect(msg).toMatch(/coordinaci[oó]n interna/i);
    expect(msg).not.toMatch(/etapa de vida|alto potencial/i);
  });

  it("drops generic evaluative sentences from confirmation synthesis", () => {
    const raw =
      "Tu oferta tiene alto potencial en un mercado saturado. Lo esencial es que vendes un servicio operativo con entregas claras.";
    expect(sanitizeInterpretationCoreForSegmentConfirmation(raw)).not.toMatch(
      /alto potencial|mercado saturado/i,
    );
    expect(sanitizeInterpretationCoreForSegmentConfirmation(raw)).toMatch(/operativo|entregas/i);
    const msg = buildSegmentConfirmationAssistantMessage(minimalExtraction(raw));
    expect(msg).not.toMatch(/alto potencial|mercado saturado/i);
    expect(msg).toMatch(/operativo|entregas/i);
  });
});

describe("mergeResponsesWithInterviewTrace", () => {
  it("replaces _limbic_interview_v1 so removed segment_confirmation_pending does not survive", () => {
    const pending = {
      version: 1 as const,
      mini_step: "tailored_what" as const,
      extraction: extractionPayloadForTrace(minimalExtraction("captura anterior")),
    };
    const withPending = traceWithPending(pending);
    const cleared = stripSegmentConfirmationPending({
      ...withPending,
      phase: "main",
      mini_step: "problem",
    });
    const merged = mergeResponsesWithInterviewTrace(
      {
        strategic_base: {},
        _limbic_interview_v1: withPending as unknown as Record<string, unknown>,
      },
      cleared,
    );
    const tr = merged._limbic_interview_v1 as Record<string, unknown>;
    expect(tr.segment_confirmation_pending).toBeUndefined();
    expect(tr.mini_step).toBe("problem");
  });
});

describe("stale segment_confirmation_pending", () => {
  it("ignores pending for a different mini_step when phase is main and routes a normal answer", () => {
    const staleTrace: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "main",
      follow_up_used: false,
      mini_step: "problem",
      turns: [],
      segment_confirmation_pending: {
        version: 1,
        mini_step: "tailored_what",
        extraction: extractionPayloadForTrace(
          minimalExtraction("contenido de un paso anterior"),
        ),
      },
    };
    const d = resolveGuidedIntakeTurn({
      userText: "La fricción central es que los padres necesitan confiar en la agencia.",
      miniStep: "problem",
      trace: staleTrace,
    });
    expect(d.action).toBe("llm_extraction");
    expect(d.notes_for_route.branch).toBe("llm_extraction");
  });

  it("still resolves segment confirmation when phase is segment_confirmation and pending targets another step (cross-flow)", () => {
    const cross: LimbicInterviewTraceV1 = {
      version: 1,
      pilot_id: "strategic_interview_v1",
      phase: "segment_confirmation",
      follow_up_used: false,
      mini_step: "evidence",
      turns: [],
      segment_confirmation_pending: {
        version: 1,
        mini_step: "audience",
        extraction: extractionPayloadForTrace(
          minimalExtraction("síntesis de audiencia"),
        ),
      },
    };
    const d = resolveGuidedIntakeTurn({
      userText: "sí",
      miniStep: "evidence",
      trace: cross,
    });
    expect(d.action).toBe("segment_confirmation_resolve");
    expect(d.notes_for_route.segmentConfirmationKind).toBe("confirm");
  });
});

describe("resolveGuidedIntakeTurn segment_confirmation_resolve", () => {
  const pending = {
    version: 1 as const,
    mini_step: "tailored_what" as const,
    extraction: extractionPayloadForTrace(minimalExtraction("captura interpretada")),
  };

  it("does not advance on ambiguous reply (reprompt / unknown)", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "mmm",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.action).toBe("segment_confirmation_resolve");
    expect(d.should_not_advance).toBe(true);
    expect(d.notes_for_route.segmentConfirmationKind).toBe("reprompt");
    expect(d.skip_llm_extraction).toBe(true);
  });

  it("advances on explicit confirm", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "confirmo",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("confirm");
    expect(d.should_advance).toBe(true);
    expect(d.should_not_advance).toBe(false);
    expect(d.next_phase).toBe("main");
  });

  it("reopens correction path without advancing", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "quiero corregir",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("correct");
    expect(d.should_not_advance).toBe(true);
    expect(d.writes_to_responses).toBe(false);
  });

  it("routes help to segment_confirmation hold without advancing", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "ayúdame a definirlo",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("help");
    expect(d.next_phase).toBe("segment_confirmation");
    expect(d.should_not_advance).toBe(true);
    expect(d.requires_confirmation).toBe(true);
  });

  it("advances when user signals missing info or explicit pending (single step)", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "no tengo esa información",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("pending_ack_confirm");
    expect(d.should_advance).toBe(true);
    expect(d.next_phase).toBe("main");
  });

  it("advances on dejarlo pendiente without a second ack round", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "dejarlo pendiente",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("pending_ack_confirm");
    expect(d.should_advance).toBe(true);
  });

  it("pending_ack_confirm advances with pending_confirmed patch", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "sí, pendiente",
      miniStep: "tailored_what",
      trace: traceWithPending({
        ...pending,
        awaiting_pending_ack: true,
      }),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("pending_ack_confirm");
    expect(d.should_advance).toBe(true);
    expect(d.decision_status_updates.some((p) => p.status === "pending_confirmed")).toBe(
      true,
    );
  });

  it("frustration reply keeps confirmation open without reprompt kind", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "ya te respondí",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("frustration");
    expect(d.should_not_advance).toBe(true);
    expect(d.next_phase).toBe("segment_confirmation");
  });
});

describe("classifySegmentConfirmationUserReply", () => {
  it("maps semantic equivalents without exact UI wording", () => {
    expect(
      classifySegmentConfirmationUserReply({
        userText: "dejémoslo así",
        awaitingPendingAck: false,
      }),
    ).toBe("confirm");
    expect(
      classifySegmentConfirmationUserReply({
        userText: "confirmar",
        awaitingPendingAck: false,
      }),
    ).toBe("confirm");
    expect(
      classifySegmentConfirmationUserReply({
        userText: "no, eso no",
        awaitingPendingAck: false,
      }),
    ).toBe("correct");
  });

  it("treats short affirmations and colloquial confirm phrases as confirm", () => {
    expect(
      classifySegmentConfirmationUserReply({ userText: "está bien", awaitingPendingAck: false }),
    ).toBe("confirm");
    expect(
      classifySegmentConfirmationUserReply({ userText: "si", awaitingPendingAck: false }),
    ).toBe("confirm");
    expect(
      classifySegmentConfirmationUserReply({ userText: "me sirve", awaitingPendingAck: false }),
    ).toBe("confirm");
  });

  it("treats adjustment verbs as correction", () => {
    expect(
      classifySegmentConfirmationUserReply({ userText: "Ajustemos", awaitingPendingAck: false }),
    ).toBe("correct");
  });

  it("treats help and improvement asks as help", () => {
    expect(
      classifySegmentConfirmationUserReply({
        userText: "ayúdame a mejorarlo",
        awaitingPendingAck: false,
      }),
    ).toBe("help");
  });

  it("treats frustration as its own class", () => {
    expect(
      classifySegmentConfirmationUserReply({
        userText: "Ya te respondí",
        awaitingPendingAck: false,
      }),
    ).toBe("frustration");
  });
});

describe("pilot summary gating", () => {
  it("blocks summary when any required segment is not confirmed or pending_confirmed", () => {
    expect(
      pilotSummaryBlockedByDecisionStates(
        { tailored_what: { status: "provisional" } },
        { userExplicitProceed: false },
      ),
    ).toBe(true);
    expect(
      pilotSummaryBlockedByDecisionStates(
        { tailored_what: { status: "confirmed" } },
        { userExplicitProceed: false },
      ),
    ).toBe(false);
  });

  it("blocks summary while segment confirmation is open", () => {
    expect(
      pilotSummaryBlockedByDecisionStates(undefined, {
        userExplicitProceed: false,
        hasOpenSegmentConfirmation: true,
      }),
    ).toBe(true);
  });
});

describe("cross-topic extraction decision", () => {
  it("marks cross-topic substantive updates as provisional (confirmation still required)", () => {
    const d = resolveGuidedIntakeTurn({
      userText:
        "Pensándolo mejor, la audiencia principal son equipos internos de operaciones y no los consumidores finales, porque ellos bloquean la compra y definen el presupuesto.",
      miniStep: "evidence",
      trace: {
        version: 1,
        pilot_id: "strategic_interview_v1",
        phase: "main",
        follow_up_used: false,
        mini_step: "evidence",
        turns: [],
      },
    });
    expect(d.notes_for_route.branch).toBe("cross_topic_llm_extraction");
    expect(d.decision_status_updates[0]?.status).toBe("provisional");
  });
});

describe("production logic avoids segment-specific hardcoded copy in gate helpers", () => {
  it("gate module has no domain-specific exemplar strings", () => {
    const gatePath = fileURLToPath(new URL("./segment-confirmation-gate.ts", import.meta.url));
    const src = readFileSync(gatePath, "utf8");
    expect(src).not.toMatch(/teen|padres|viajeros/i);
  });
});
