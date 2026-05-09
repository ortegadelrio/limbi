import { describe, expect, it } from "vitest";
import {
  initialTrace,
  type AudienceRecommendationPendingV1,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import { resolveGuidedIntakeTurn } from "@/lib/intake/conversational-engine/resolve-guided-intake-turn";
import type {
  ConversationalEngineRouteBranch,
  ConversationalUserIntent,
} from "@/lib/intake/conversational-engine/types";

function traceBase(over: Partial<LimbicInterviewTraceV1> = {}): LimbicInterviewTraceV1 {
  return {
    ...initialTrace(),
    phase: "main",
    mini_step: "audience",
    turns: [],
    ...over,
  };
}

const SAMPLE_PENDING: AudienceRecommendationPendingV1 = {
  version: 1,
  primary_label: "Núcleo operativo",
  secondary_label: "Red colaborativa",
};

type Case = {
  id: string;
  trace: LimbicInterviewTraceV1;
  userText: string;
  expect: {
    branch: ConversationalEngineRouteBranch;
    user_intent: ConversationalUserIntent;
    summary_allowed: boolean;
    skip_llm_extraction: boolean;
    render_policy?: "single_surface_no_competing_bank" | "default";
    pendingAudienceReplyKind?: string;
    /** Pending-audience path must stay ahead of meta-question classification elsewhere. */
    not_branch?: ConversationalEngineRouteBranch;
  };
};

const cases: Case[] = [
  {
    id: "pending_confirmation_confirm_advances",
    trace: traceBase({
      mini_step: "audience",
      audience_recommendation_pending: SAMPLE_PENDING,
    }),
    userText: "Sí, adelante con ese orden.",
    expect: {
      branch: "pending_audience_confirmation",
      user_intent: "confirmation",
      summary_allowed: false,
      skip_llm_extraction: true,
      pendingAudienceReplyKind: "confirm",
    },
  },
  {
    id: "pending_confirmation_explicit_unclear_missing_info",
    trace: traceBase({
      mini_step: "audience",
      audience_recommendation_pending: SAMPLE_PENDING,
    }),
    userText: "No tengo la información para decidir prioridades aún.",
    expect: {
      branch: "pending_audience_confirmation",
      user_intent: "missing_information",
      summary_allowed: false,
      skip_llm_extraction: true,
      pendingAudienceReplyKind: "explicit_unclear",
    },
  },
  {
    id: "pending_confirmation_reject_priority",
    trace: traceBase({
      mini_step: "audience",
      audience_recommendation_pending: SAMPLE_PENDING,
    }),
    userText: "Prefiero otro orden distinto al que planteas.",
    expect: {
      branch: "pending_audience_confirmation",
      user_intent: "rejection",
      summary_allowed: false,
      skip_llm_extraction: true,
      pendingAudienceReplyKind: "reject_priority",
    },
  },
  {
    id: "pending_confirmation_return_to_audience_topic",
    trace: traceBase({
      mini_step: "audience",
      audience_recommendation_pending: SAMPLE_PENDING,
    }),
    userText: "Volvamos a la audiencia, quiero afinar el público primero.",
    expect: {
      branch: "pending_audience_confirmation",
      user_intent: "return_to_previous_topic",
      summary_allowed: false,
      skip_llm_extraction: true,
      pendingAudienceReplyKind: "restart_strategic_audience",
    },
  },
  {
    id: "pending_confirmation_secondary_emphasis_before_llm",
    trace: traceBase({
      mini_step: "audience",
      audience_recommendation_pending: SAMPLE_PENDING,
    }),
    userText: "Solo Red colaborativa me interesa priorizar en esta etapa.",
    expect: {
      branch: "pending_audience_confirmation",
      user_intent: "strategic_validation_question",
      summary_allowed: false,
      skip_llm_extraction: true,
      render_policy: "single_surface_no_competing_bank",
      pendingAudienceReplyKind: "secondary_emphasis_invert_prompt",
      not_branch: "llm_extraction",
    },
  },
  {
    id: "pending_confirmation_meta_question_still_pending_branch",
    trace: traceBase({
      mini_step: "audience",
      audience_recommendation_pending: SAMPLE_PENDING,
    }),
    userText: "¿Qué significa exactamente priorizar en este paso?",
    expect: {
      branch: "pending_audience_confirmation",
      user_intent: "ambiguous_answer",
      summary_allowed: false,
      skip_llm_extraction: true,
      pendingAudienceReplyKind: "reprompt_confirmation",
      not_branch: "deterministic_clarification",
    },
  },
  {
    id: "evidence_return_to_audience",
    trace: traceBase({ mini_step: "evidence", phase: "main" }),
    userText: "Volvamos a la audiencia antes de seguir.",
    expect: {
      branch: "evidence_return_to_audience",
      user_intent: "return_to_previous_topic",
      summary_allowed: false,
      skip_llm_extraction: true,
      render_policy: "single_surface_no_competing_bank",
    },
  },
  {
    id: "evidence_missing_information_not_meta_question",
    trace: traceBase({ mini_step: "evidence", phase: "main" }),
    userText: "No tengo claridad todavía sobre métricas o resultados medibles.",
    expect: {
      branch: "evidence_uncertainty_advance",
      user_intent: "missing_information",
      summary_allowed: false,
      skip_llm_extraction: true,
    },
  },
  {
    id: "evidence_clarification_meta_question_not_uncertainty_shortcut",
    trace: traceBase({ mini_step: "evidence", phase: "main" }),
    userText: "¿Qué significa evidencia en este paso?",
    expect: {
      branch: "deterministic_clarification",
      user_intent: "clarification_question",
      summary_allowed: false,
      skip_llm_extraction: false,
      render_policy: "single_surface_no_competing_bank",
      not_branch: "evidence_uncertainty_advance",
    },
  },
  {
    id: "deterministic_strategic_validation_no_pending",
    trace: traceBase({ mini_step: "audience", phase: "main" }),
    userText: "¿Crees que tiene sentido priorizar impacto interno antes que alianzas?",
    expect: {
      branch: "deterministic_strategic_validation",
      user_intent: "strategic_validation_question",
      summary_allowed: false,
      skip_llm_extraction: true,
      render_policy: "single_surface_no_competing_bank",
    },
  },
  {
    id: "follow_up_phase_defers_deterministic_strategic_to_llm_branch",
    trace: traceBase({
      mini_step: "audience",
      phase: "follow_up",
      follow_up_used: true,
    }),
    userText: "¿Te parece bien este orden de prioridades?",
    expect: {
      branch: "llm_extraction",
      user_intent: "answer",
      summary_allowed: false,
      skip_llm_extraction: false,
      not_branch: "deterministic_strategic_validation",
    },
  },
  {
    id: "substantive_answer_uses_llm_branch",
    trace: traceBase({ mini_step: "audience", phase: "main" }),
    userText:
      "Trabajamos con tres grupos de interés recurrentes y queremos ordenar impacto y esfuerzo.",
    expect: {
      branch: "llm_extraction",
      user_intent: "answer",
      summary_allowed: false,
      skip_llm_extraction: false,
    },
  },
  {
    id: "evidence_step_actor_language_routes_to_audience_redirect",
    trace: traceBase({ mini_step: "evidence", phase: "main" }),
    userText:
      "La institución que contrata el servicio y sus equipos clave. También es un actor importante en cómo se escucha la propuesta.",
    expect: {
      branch: "evidence_audience_actor_redirect",
      user_intent: "correction",
      summary_allowed: false,
      skip_llm_extraction: true,
      render_policy: "single_surface_no_competing_bank",
    },
  },
  {
    id: "evidence_step_premium_positioning_routes_to_positioning_redirect",
    trace: traceBase({ mini_step: "evidence", phase: "main" }),
    userText: "Es un servicio premium con propuesta de valor diferenciada.",
    expect: {
      branch: "evidence_positioning_claim_redirect",
      user_intent: "strategic_validation_question",
      summary_allowed: false,
      skip_llm_extraction: true,
      render_policy: "single_surface_no_competing_bank",
    },
  },
];

describe("resolveGuidedIntakeTurn (pattern table)", () => {
  it.each(cases)("$id", ({ trace, userText, expect: x }) => {
    const d = resolveGuidedIntakeTurn({ userText, miniStep: trace.mini_step ?? "audience", trace });
    expect(d.notes_for_route.branch).toBe(x.branch);
    expect(d.user_intent).toBe(x.user_intent);
    expect(d.summary_allowed).toBe(x.summary_allowed);
    expect(d.skip_llm_extraction).toBe(x.skip_llm_extraction);
    if (x.render_policy) expect(d.render_policy).toBe(x.render_policy);
    if (x.pendingAudienceReplyKind) {
      expect(d.notes_for_route.pendingAudienceReplyKind).toBe(x.pendingAudienceReplyKind);
    }
    if (x.not_branch) {
      expect(d.notes_for_route.branch).not.toBe(x.not_branch);
    }
    if (
      x.branch === "deterministic_clarification" ||
      x.branch === "deterministic_strategic_validation" ||
      x.branch === "evidence_audience_actor_redirect" ||
      x.branch === "evidence_positioning_claim_redirect"
    ) {
      expect(d.should_not_advance).toBe(true);
    }
    if (x.branch === "pending_audience_confirmation" && x.pendingAudienceReplyKind) {
      if (x.pendingAudienceReplyKind === "explicit_unclear" || x.pendingAudienceReplyKind === "confirm") {
        expect(d.should_advance).toBe(true);
        expect(d.should_not_advance).toBe(false);
      } else if (x.pendingAudienceReplyKind !== "explicit_unclear") {
        expect(d.should_not_advance).toBe(true);
      }
    }
  });

  it("keeps summary_allowed false for every table row (completion is route-owned)", () => {
    for (const c of cases) {
      const d = resolveGuidedIntakeTurn({
        userText: c.userText,
        miniStep: c.trace.mini_step ?? "audience",
        trace: c.trace,
      });
      expect(d.summary_allowed, c.id).toBe(false);
    }
  });

  it("phrases that look like correction or skip still defer to LLM branch in Phase 1", () => {
    const trace = traceBase({ mini_step: "audience", phase: "main" });
    const skipLike = resolveGuidedIntakeTurn({
      userText: "Saltemos este paso por ahora y seguimos después.",
      miniStep: "audience",
      trace,
    });
    expect(skipLike.notes_for_route.branch).toBe("llm_extraction");
    expect(skipLike.user_intent).toBe("answer");
    const correctionLike = resolveGuidedIntakeTurn({
      userText: "Quiero corregir: la idea anterior no refleja lo que buscamos.",
      miniStep: "audience",
      trace,
    });
    expect(correctionLike.notes_for_route.branch).toBe("llm_extraction");
    expect(correctionLike.user_intent).toBe("answer");
  });

  it("invert decline stays on pending confirmation branch", () => {
    const pending: AudienceRecommendationPendingV1 = {
      ...SAMPLE_PENDING,
      invert_question_active: true,
    };
    const trace = traceBase({
      mini_step: "audience",
      audience_recommendation_pending: pending,
    });
    const d = resolveGuidedIntakeTurn({
      userText: "No, mejor mantengamos Núcleo operativo como prioridad.",
      miniStep: "audience",
      trace,
    });
    expect(d.notes_for_route.branch).toBe("pending_audience_confirmation");
    expect(d.notes_for_route.pendingAudienceReplyKind).toBe("decline_invert_reprompt");
    expect(d.user_intent).toBe("strategic_validation_question");
    expect(d.summary_allowed).toBe(false);
  });
});
