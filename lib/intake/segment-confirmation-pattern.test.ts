import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine";
import {
  buildSegmentConfirmationAssistantMessage,
  classifySegmentConfirmationUserReply,
} from "@/lib/intake/segment-confirmation";
import {
  extractionPayloadForTrace,
  miniStepRequiresSegmentConfirmationGate,
  shouldOfferSegmentConfirmationAfterExtraction,
} from "@/lib/intake/segment-confirmation-gate";
import { pilotSummaryBlockedByDecisionStates } from "@/lib/intake/decision-state";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";

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
): IntakeExtractionOutput {
  return {
    extracted_response_updates: {},
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

  it("builds confirmation copy from interpreted interviewer_message only", () => {
    const msg = buildSegmentConfirmationAssistantMessage(
      minimalExtraction("interpretación resumida"),
    );
    expect(msg).toContain("Esto es lo que estoy entendiendo:");
    expect(msg).toContain("interpretación resumida");
    expect(msg).toContain("Sistema Límbico");
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

  it("routes help to strategy_validation hold without advancing", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "ayúdame a definirlo",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("help");
    expect(d.next_phase).toBe("strategy_validation");
    expect(d.should_not_advance).toBe(true);
    expect(d.requires_confirmation).toBe(true);
  });

  it("asks pending ack after user signals missing info", () => {
    const d = resolveGuidedIntakeTurn({
      userText: "no tengo esa información",
      miniStep: "tailored_what",
      trace: traceWithPending(pending),
    });
    expect(d.notes_for_route.segmentConfirmationKind).toBe("pending_prompt");
    expect(d.next_phase).toBe("segment_confirmation");
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
        userText: "no, eso no",
        awaitingPendingAck: false,
      }),
    ).toBe("correct");
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
