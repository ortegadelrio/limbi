import { describe, expect, it } from "vitest";
import { deepMergeResponses } from "@/lib/utils/deep-merge";
import {
  buildSyntheticExtractionForChip,
  computeTraceAfterStrategicLlmExtraction,
  initialTrace,
  LIMBIC_INTERVIEW_TRACE_KEY,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import { interviewerCopyContainsGenericPhrases } from "@/lib/intake/limbi-interviewer-copy";
import {
  applyStrategicInterviewExtraction,
  collectSatisfiedWizardIndices,
  GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
} from "@/lib/intake/strategic-interview-apply";
import {
  audienceIsCommittedForPilotSummary,
  buildStrategicInterviewPilotSummary,
} from "@/lib/intake/strategic-interview-summary";

function traceAtAudience(): LimbicInterviewTraceV1 {
  return {
    ...initialTrace(),
    mini_step: "audience",
    phase: "main",
    follow_up_used: false,
    turns: [],
  };
}

describe("computeTraceAfterStrategicLlmExtraction", () => {
  it("does not advance mini_step when needs_follow_up is true", () => {
    const trace = traceAtAudience();
    const { nextTrace, wantsFollowUp } = computeTraceAfterStrategicLlmExtraction({
      trace,
      extraction: {
        needs_follow_up: true,
        follow_up_question: "¿A quién convencemos primero: adolescentes o padres?",
      },
    });
    expect(wantsFollowUp).toBe(true);
    expect(nextTrace.phase).toBe("follow_up");
    expect(nextTrace.mini_step).toBe("audience");
  });

  it("advances one mini_step after follow-up phase answer (no follow-up)", () => {
    const trace: LimbicInterviewTraceV1 = {
      ...traceAtAudience(),
      phase: "follow_up",
      follow_up_used: true,
    };
    const { nextTrace, wantsFollowUp } = computeTraceAfterStrategicLlmExtraction({
      trace,
      extraction: { needs_follow_up: false, follow_up_question: null },
    });
    expect(wantsFollowUp).toBe(false);
    expect(nextTrace.phase).toBe("main");
    expect(nextTrace.mini_step).toBe("evidence");
    expect(nextTrace.follow_up_used).toBe(false);
  });
});

describe("collectSatisfiedWizardIndices (audience skip)", () => {
  it("does not mark wizard audience when audience_pending limitation is present", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Descripción larga suficiente",
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "Situación concreta descrita aquí",
        transformation_type: "understand_better",
        transformation_to: "Resultado concreto suficiente",
        guided_intake_limitations_optional: [
          "guided_intake:not_available_yet",
          GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
        ],
      },
      audience_base: { audience_type: "end_consumers" },
      evidence_base: { evidence_types: ["survey"] },
    };
    expect(collectSatisfiedWizardIndices(merged)).not.toContain(6);
  });
});

describe("chip no_information + audience step limitation", () => {
  it("merges synthetic skip then audience_pending blocks wizard step 6", () => {
    const extraction = buildSyntheticExtractionForChip("no_information", []);
    let merged = applyStrategicInterviewExtraction({}, extraction).mergedResponses;
    const sb = merged.strategic_base as Record<string, unknown>;
    const lim = Array.isArray(sb.guided_intake_limitations_optional)
      ? ([
          ...(sb.guided_intake_limitations_optional as string[]),
        ] as string[])
      : [];
    merged = deepMergeResponses(merged, {
      strategic_base: {
        ...sb,
        guided_intake_limitations_optional: [
          ...lim,
          GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
        ],
      },
    });
    expect(lim).toContain("guided_intake:not_available_yet");
    const lim2 = (merged.strategic_base as Record<string, unknown>)
      .guided_intake_limitations_optional as string[];
    expect(lim2).toContain(GUIDED_INTAKE_AUDIENCE_PENDING_LIM);

    const mergedAsIfPriorStepsDone = deepMergeResponses(merged, {
      strategic_base: {
        simple_description: "Descripción larga suficiente",
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "Problema concreto suficiente",
        transformation_type: "understand_better",
        transformation_to: "Beneficio concreto suficiente",
        guided_intake_limitations_optional: lim2,
      },
      audience_base: { audience_type: "end_consumers" },
      evidence_base: { evidence_types: ["survey"] },
    });
    expect(collectSatisfiedWizardIndices(mergedAsIfPriorStepsDone)).not.toContain(6);
  });
});

describe("buildStrategicInterviewPilotSummary", () => {
  it("does not use consumidores finales when audience is missing", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Un servicio de apoyo logístico para viajes",
        offering_type: "service",
        problem_category: "lack_trust",
        problem_description_optional: "Personas que dudan antes de reservar",
        transformation_type: "decide_confidently",
        transformation_to: "Reservar con información clara y respaldo",
      },
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const summary = buildStrategicInterviewPilotSummary(
      merged,
      "service",
      false,
      {},
    );
    expect(summary.title).toMatch(/primera captura/i);
    expect(summary.weakLine).toBeNull();
    expect(summary.body).toMatch(/1\. Lo que entendí/i);
    expect(summary.body.toLowerCase()).not.toContain("consumidor");
    expect(audienceIsCommittedForPilotSummary(merged, {})).toBe(false);
  });

  it("teen travel style: diagnostic body lists friction and gaps without weakLine duplication", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description:
          "Un servicio que ayuda a organizar itinerarios de viaje con más sentido y acompañamiento para grupos jóvenes",
        offering_type: "service",
        problem_category: "lack_trust",
        problem_description_optional:
          "Adolescentes que viajan sin la supervisión directa de sus padres",
        transformation_type: "decide_confidently",
        transformation_to:
          "Pueden vivir la experiencia con autonomía, con protocolos y respaldo operativo de la agencia para que las familias confíen",
      },
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const summary = buildStrategicInterviewPilotSummary(
      merged,
      "service",
      false,
      {
        "strategic_base.simple_description": 0.9,
        "strategic_base.problem_category": 0.85,
        "strategic_base.transformation_type": 0.88,
      },
    );
    expect(summary.body).toMatch(/viaje|itinerario|adolescente/i);
    expect(summary.weakLine).toBeNull();
    expect(summary.body).toMatch(/6\. Huecos o puntos a precisar/i);
    expect(summary.body.toLowerCase()).not.toContain("consumidor");
  });

  it("lists actores from trace summaries when audience_description_optional is absent", () => {
    const trace: LimbicInterviewTraceV1 = {
      ...initialTrace(),
      phase: "done",
      mini_step: "complete",
      turns: [
        {
          at: "2026-01-01T00:00:00.000Z",
          role: "user",
          summary:
            "Quienes firman el contrato no suelen ser quienes usan la herramienta cada semana.",
        },
      ],
    };
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Plataforma de reportes para equipos de operaciones",
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "Datos dispersos entre ventas y operaciones.",
        transformation_type: "understand_better",
        transformation_to: "Una vista única con responsables por etapa.",
      },
      audience_base: {},
      evidence_base: { evidence_types: ["survey"] },
      [LIMBIC_INTERVIEW_TRACE_KEY]: trace as unknown as Record<string, unknown>,
    };
    const s = buildStrategicInterviewPilotSummary(merged, "service", false, {
      "strategic_base.simple_description": 0.88,
    });
    expect(s.body).toMatch(/Actores identificados:/i);
    expect(s.body).not.toMatch(/No constan aún actores/i);
  });

  it("shows actores identificados when description exists without committed priority", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Herramienta para alinear entregas entre socios y clientes corporativos",
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "Información dispersa entre quien vende y quien implementa",
        transformation_type: "understand_better",
        transformation_to: "Un solo tablero con responsables claros",
      },
      audience_base: {
        audience_description_optional:
          "Los equipos de cuenta suelen abrir la conversación; dirección de operaciones autoriza el cierre.",
      },
      evidence_base: {
        evidence_types: ["testimonials"],
        evidence_details: {
          testimonials: "Referencias verificables de los últimos doce meses.",
        },
      },
    };
    const s = buildStrategicInterviewPilotSummary(merged, "service", false, {
      "strategic_base.simple_description": 0.88,
      "strategic_base.problem_category": 0.8,
      "strategic_base.transformation_type": 0.82,
    });
    expect(s.body).toMatch(/Actores identificados:/i);
    expect(s.body).toMatch(/Falta definir prioridad/i);
    expect(s.body).not.toMatch(/No constan aún actores/i);
    expect(s.body).toMatch(/Evidencia mencionada/i);
    expect(s.body).not.toMatch(/\btestimonials\b/i);
  });

  it("keeps a short concrete audience_description as identified actors", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Servicio de acompañamiento para decisiones de compra",
        offering_type: "service",
        problem_category: "lack_trust",
        problem_description_optional: "Dudas antes de comprometerse.",
        transformation_type: "decide_confidently",
        transformation_to: "Elegir con información ordenada y comparables claros.",
      },
      audience_base: {
        audience_description_optional: "Hijos",
      },
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const s = buildStrategicInterviewPilotSummary(merged, "service", false, {
      "strategic_base.simple_description": 0.88,
    });
    expect(s.body).toMatch(/Actores identificados:.*Hijos/i);
    expect(s.body).not.toMatch(/No constan aún actores/i);
  });

  it("does not treat end_consumers as committed when confidence is low", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "x".repeat(20),
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "Problema concreto suficiente",
        transformation_type: "understand_better",
        transformation_to: "y".repeat(14),
      },
      audience_base: { audience_type: "end_consumers" },
      evidence_base: { evidence_types: ["survey"] },
    };
    expect(
      audienceIsCommittedForPilotSummary(merged, {
        "audience_base.audience_type": 0.4,
      }),
    ).toBe(false);
    const s = buildStrategicInterviewPilotSummary(merged, "service", false, {
      "audience_base.audience_type": 0.4,
    });
    expect(s.body.toLowerCase()).not.toContain("consumidor");
  });
});

describe("interviewerCopyContainsGenericPhrases", () => {
  it("flags stock praise / vague follow-up scaffolding", () => {
    expect(interviewerCopyContainsGenericPhrases("Suena muy útil para tu caso.")).toBe(
      true,
    );
    expect(
      interviewerCopyContainsGenericPhrases(
        "Entiendo esto: hay dos decisores en tensión. Me falta precisar cuál priorizas.",
      ),
    ).toBe(false);
  });
});
