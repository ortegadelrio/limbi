import { describe, expect, it } from "vitest";
import { detectDeterministicClarificationIntent } from "@/lib/intake/guided-intake-clarification";
import {
  detectMultiActorRecommendationContext,
  extractActorsForAudienceRecommendation,
} from "@/lib/intake/guided-intake-multi-actor-audience";
import {
  buildAudienceConfirmMergeAndExtraction,
  buildAudiencePendingAmbiguousTurnContent,
  buildStrategicValidationSyntheticExtraction,
  buildStrategicValidationTurnContent,
  classifyPendingAudienceUserReply,
  detectAudienceExplicitUnclear,
  detectAudienceRecommendationConfirm,
  detectDeterministicStrategicValidationIntent,
  detectReturnToAudienceTopicIntent,
  isStrategicRecommendationAsk,
} from "@/lib/intake/guided-intake-strategic-validation";
import {
  applyStrategicInterviewExtraction,
  GUIDED_INTAKE_AUDIENCE_PENDING_LIM,
} from "@/lib/intake/strategic-interview-apply";
import { buildStrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";

describe("isStrategicRecommendationAsk", () => {
  it("treats marketing-expert phrasing as a recommendation request", () => {
    expect(
      isStrategicRecommendationAsk("Cuál consideras tú, de acuerdo a tu experiencia"),
    ).toBe(true);
  });
});

describe("detectDeterministicStrategicValidationIntent", () => {
  it("detects agreement-seeking combined with hypothesis (evidence step scenario)", () => {
    const t =
      "No tengo evidencias, pero me gustaría preguntarte si estás de acuerdo en que los padres deben ser el objetivo";
    expect(detectDeterministicStrategicValidationIntent(t)).toBe(true);
  });

  it("detects common validation phrasings", () => {
    expect(detectDeterministicStrategicValidationIntent("¿Crees que este enfoque está bien?")).toBe(
      true,
    );
    expect(
      detectDeterministicStrategicValidationIntent(
        "¿Te parece que los padres deben ser la audiencia principal?",
      ),
    ).toBe(true);
  });

  it("does not fire on pure clarification about a term", () => {
    expect(detectDeterministicStrategicValidationIntent("¿A qué te refieres con evidencia?")).toBe(
      false,
    );
    expect(detectDeterministicClarificationIntent("¿A qué te refieres con evidencia?")).toBe(true);
  });

  it("treats ‘¿Qué opinas…?’ as strategic validation (API checks this before clarification)", () => {
    const t = "¿Qué opinas de que el público sean los padres?";
    expect(detectDeterministicStrategicValidationIntent(t)).toBe(true);
  });

  it("detects short recommendation requests (especially audience step)", () => {
    const examples = [
      "¿A quién me recomendarías?",
      "¿Cuál me recomiendas?",
      "¿Cuál debería priorizar?",
      "¿A quién debería convencer primero?",
      "¿Qué público ves más importante?",
      "¿Qué me sugieres?",
      "¿Cuál crees que es mejor?",
      "¿Tú qué harías?",
    ];
    for (const s of examples) {
      expect(detectDeterministicStrategicValidationIntent(s, { miniStep: "audience" })).toBe(true);
    }
  });

  it("does not classify recommendation asks as clarification", () => {
    expect(detectDeterministicClarificationIntent("¿A quién me recomendarías?")).toBe(false);
  });

  it("does not treat audience recommendation as strategic validation while on evidence (API routes separately)", () => {
    expect(
      detectDeterministicStrategicValidationIntent("¿A quién me recomiendas?", {
        miniStep: "evidence",
      }),
    ).toBe(false);
    expect(detectReturnToAudienceTopicIntent("¿A quién me recomiendas?")).toBe(true);
  });

  it("treats uncertain audience recommendation ask on audience step as strategic validation", () => {
    expect(
      detectDeterministicStrategicValidationIntent("No estoy seguro, ¿a quién crees?", {
        miniStep: "audience",
      }),
    ).toBe(true);
    expect(detectAudienceExplicitUnclear("No estoy seguro, ¿a quién crees?")).toBe(false);
  });
});

describe("detectReturnToAudienceTopicIntent", () => {
  it("detects return / refocus phrasing without hardcoding a vertical", () => {
    expect(detectReturnToAudienceTopicIntent("Me gustaría definir quién es la audiencia")).toBe(
      true,
    );
    expect(detectReturnToAudienceTopicIntent("Volvamos a la audiencia")).toBe(true);
    expect(detectReturnToAudienceTopicIntent("Quiero ajustar el público")).toBe(true);
  });
});

describe("detectMultiActorRecommendationContext", () => {
  it("is true when two actors are grounded in user text", () => {
    expect(
      detectMultiActorRecommendationContext(
        "¿Cuál priorizo?",
        [{ role: "user", summary: "Gerentes comerciales, usuarios del equipo de ventas" }],
        "software b2b",
      ),
    ).toBe(true);
  });

  it("is true when a guidance fragment plus confirmed strategic fields yield two clean actors", () => {
    expect(
      detectMultiActorRecommendationContext(
        "Yo diria que a los niños, pero recomiéndame porque tengo dudas",
        [],
        "",
        {
          simple_description: "",
          problem_description_optional: "Los padres necesitan confiar antes de autorizar.",
        },
      ),
    ).toBe(true);
  });

  it("is false when an ambiguous actor remains unresolved in the same turn", () => {
    const line =
      "Creería que al gobierno local y también a los señores para que vayan a la casa, tú qué opinas?";
    expect(detectMultiActorRecommendationContext(line, [], "subsidios vecinales")).toBe(false);
  });
});

describe("extractActorsForAudienceRecommendation", () => {
  it("never treats opinion tails or questions as actors", () => {
    const line =
      "Creería que al gobierno local y también a los señores para que vayan a la casa, tú qué opinas?";
    const { clean, ambiguous } = extractActorsForAudienceRecommendation(line, "");
    expect(clean.some((a) => /tú qué opinas|opinas\?/i.test(a.label))).toBe(false);
    expect(clean.some((a) => /creería que/i.test(a.label))).toBe(false);
    expect(ambiguous.some((a) => /señores/i.test(a))).toBe(true);
    expect(clean.some((a) => /gobierno local/i.test(a.label))).toBe(true);
  });

  it("does not treat subsidios as an audience actor", () => {
    const { clean } = extractActorsForAudienceRecommendation(
      "Hay subsidios estatales y apoyo municipal.",
      "",
    );
    expect(clean.some((a) => /^subsidios$/i.test(a.label.trim()))).toBe(false);
  });
});

describe("buildStrategicValidationTurnContent", () => {
  const emptyTurns: { role: string; summary: string }[] = [];

  it("evidence step keeps generic provisional framing and re-asks for evidence material", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "evidence",
      userText:
        "No tengo evidencias todavía, pero ¿crees que el posicionamiento que comenté tiene sentido?",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: {
        problem_description_optional:
          "Equipos internos dudan antes de adoptar un flujo operativo nuevo.",
        simple_description: "Software para coordinar entregas y handoffs internos.",
      },
      traceUserTurns: emptyTurns,
    });
    expect(content.interviewer_message).toContain("Sistema Límbico");
    expect(content.interviewer_message).not.toMatch(/viajes escolares|adolescentes/i);
    expect(content.next_question).toMatch(/Sigamos con evidencia/i);
    expect(content.interviewer_message).toMatch(/cifras|casos|trayectoria|testimonios/i);
    expect(content.audience_recommendation_pending).toBeNull();
  });

  it("does not advance or persist evidence when applying synthetic extraction", () => {
    const base: Record<string, unknown> = {
      strategic_base: {
        simple_description: "x".repeat(20),
        offering_type: "service",
        problem_description_optional: "Adolescentes viajando sin padres",
        transformation_to: "y".repeat(14),
      },
      evidence_base: {
        evidence_types: ["results"],
        evidence_details: { results: "dato previo" },
      },
    };
    const content = buildStrategicValidationTurnContent({
      miniStep: "evidence",
      userText: "¿Crees que los padres son el público correcto?",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: base.strategic_base as Record<string, unknown>,
      traceUserTurns: emptyTurns,
    });
    const ex = buildStrategicValidationSyntheticExtraction(content);
    const { mergedResponses } = applyStrategicInterviewExtraction(base, ex);
    expect(mergedResponses.evidence_base).toEqual(base.evidence_base);
    expect(ex.user_intent).toBe("strategic_validation_question");
  });

  it("fixture: colegios / padres / adolescentes — multi-actor provisional copy, no invented audiences", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "¿A quién me recomendarías?",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: {
        simple_description: "Organización de viajes escolares y grupos jóvenes",
        problem_description_optional: "Colegios que arman salidas y familias que autorizan",
      },
      traceUserTurns: [
        {
          role: "user",
          summary:
            "A los colegios porque arman los viajes más grandes y a los padres porque autorizan y pagan, y adolescentes porque son quienes desean la experiencia",
        },
      ],
    });
    expect(content.interviewer_message).toMatch(/colegios/i);
    expect(content.interviewer_message).toMatch(/padres/i);
    expect(content.interviewer_message).toMatch(/adolescentes/i);
    expect(content.interviewer_message).not.toMatch(
      /equipos internos|consumidores finales|audiencia principal.*intern/i,
    );
    expect(content.audience_recommendation_pending?.primary_label).toMatch(/colegios/i);
    expect(content.audience_recommendation_pending?.secondary_label).toMatch(/padres/i);
    expect(content.next_question).toBeNull();
    expect(content.interviewer_message).toContain(
      content.audience_recommendation_pending!.primary_label,
    );
    expect(content.interviewer_message).toContain(
      content.audience_recommendation_pending!.secondary_label,
    );
    expect(content.interviewer_message).toMatch(/¿Lo dejamos as[ií]/i);
  });

  it("B2B: gerentes comerciales y usuarios del equipo de ventas — no inventa consumidores finales", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "¿Cuál me recomiendas?",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: {
        simple_description: "Software de forecast para equipos de venta B2B",
        problem_description_optional: "Visibilidad de pipeline y coordinación entre gerencia y campo",
      },
      traceUserTurns: [
        {
          role: "user",
          summary:
            "Gerentes comerciales, porque deciden la compra, y usuarios del equipo de ventas, porque usan la herramienta.",
        },
      ],
    });
    expect(content.audience_recommendation_pending).not.toBeNull();
    expect(content.interviewer_message).toMatch(/gerentes/i);
    expect(content.interviewer_message).toMatch(/ventas|usuarios/i);
    expect(content.interviewer_message).not.toMatch(/consumidores finales|equipos internos/i);
    expect(content.interviewer_message).not.toMatch(/consumidor final/i);
    expect(content.interviewer_message).toMatch(
      /decisi[oó]n|confianza|pago|experiencia|deseo|concentrar|prometes/i,
    );
  });

  it("recommendation ask with sparse context asks for two concrete actors; no synthetic pending", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "Quién me recomiendas",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: {
        simple_description: "Una oferta con varios actores implícitos en el relato",
      },
      traceUserTurns: [],
    });
    expect(content.audience_recommendation_pending).toBeNull();
    expect(content.interviewer_message).not.toMatch(
      /community_citizens|end_consumers|b2b|b2c|equipos internos|Quien concentra/i,
    );
    expect(content.interviewer_message).toMatch(/dos actores|frase/i);
    expect(content.interviewer_message).not.toMatch(/¿Confirmas/i);
  });

  it("A. público/social: gobierno local + señores ambiguos — aclaración, sin confirmación ni frase completa", () => {
    const line =
      "Creería que al gobierno local y también a los señores para que vayan a la casa, tú qué opinas?";
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: line,
      challengeType: "corporate_communication",
      otherChallenge: false,
      strategicBase: {
        simple_description: "Programa vecinal con subsidios y visitas",
        problem_description_optional: "Legitimidad del gobierno local y apoyo a hogares",
      },
      traceUserTurns: [],
    });
    expect(content.audience_recommendation_pending).toBeNull();
    expect(content.interviewer_message).toMatch(/gobierno local/i);
    expect(content.interviewer_message).toMatch(/señores|adultos mayores|beneficiarios/i);
    expect(content.interviewer_message).not.toMatch(/tú qué opinas/i);
    expect(content.interviewer_message).not.toMatch(/Creería Que Al Gobierno/i);
    expect(content.interviewer_message).not.toMatch(/\bsubsidios\b.*actor/i);
    expect(content.next_question).toBeNull();
    expect(content.interviewer_message).not.toMatch(/¿Confirmas/i);
  });

  it("evento: patrocinadores y asistentes — roles distintos, sin audiencias genéricas inventadas", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "¿Qué me sugieres?",
      challengeType: "event",
      otherChallenge: false,
      strategicBase: {
        simple_description: "Festival corporativo con marca y experiencias en vivo",
        problem_description_optional: "Alinear valor para patrocinadores y experiencia para asistentes",
      },
      traceUserTurns: [
        {
          role: "user",
          summary: "Patrocinadores del festival y asistentes en la sede.",
        },
      ],
    });
    expect(content.audience_recommendation_pending).not.toBeNull();
    expect(content.interviewer_message).toMatch(/patrocinadores/i);
    expect(content.interviewer_message).toMatch(/asistentes/i);
    expect(content.interviewer_message).not.toMatch(/consumidores finales|equipos internos/i);
  });

  it("D. salud: pacientes, médicos y aseguradoras — tres actores sin inventar otros", () => {
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "¿Qué priorizarías?",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: {
        simple_description: "Plataforma de seguimiento clínico entre hospitales y aseguradoras",
        problem_description_optional: "Coordinación entre paciente, médico tratante y cobertura",
      },
      traceUserTurns: [
        {
          role: "user",
          summary:
            "Los pacientes usan el servicio, pero los médicos lo recomiendan y las aseguradoras autorizan.",
        },
      ],
    });
    expect(content.audience_recommendation_pending).not.toBeNull();
    expect(content.interviewer_message).toMatch(/pacientes/i);
    expect(content.interviewer_message).toMatch(/médicos|medicos/i);
    expect(content.interviewer_message).toMatch(/aseguradoras/i);
    expect(content.interviewer_message).not.toMatch(/equipos internos|consumidores finales/i);
  });

  it("recommendation turn does not merge audience_base until user confirms", () => {
    const base: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Viajes escolares con acompañamiento",
        problem_description_optional: "Colegios y familias",
      },
      audience_base: {},
    };
    const content = buildStrategicValidationTurnContent({
      miniStep: "audience",
      userText: "¿A quién me recomendarías?",
      challengeType: "service",
      otherChallenge: false,
      strategicBase: base.strategic_base as Record<string, unknown>,
      traceUserTurns: [
        { role: "user", summary: "Colegios para volumen y padres para confianza" },
      ],
    });
    const ex = buildStrategicValidationSyntheticExtraction(content);
    const { mergedResponses } = applyStrategicInterviewExtraction(base, ex);
    const ab = mergedResponses.audience_base as Record<string, unknown> | undefined;
    expect(ab?.audience_type).toBeUndefined();
    expect(ab?.audience_description_optional).toBeUndefined();
  });

  it("after plain-language confirm, audience is saved via merge helper", () => {
    const pending = {
      version: 1 as const,
      primary_label: "Colegios",
      secondary_label: "Padres",
      audience_description_draft:
        "Prioridad principal (Colegios): canal institucional. Audiencia clave complementaria (Padres): confianza y autorización.",
      audience_type_hint: "b2b" as const,
    };
    expect(
      detectAudienceRecommendationConfirm("Sí, colegios primero y padres después", pending),
    ).toBe(true);
    const base: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Viajes",
        guided_intake_limitations_optional: [GUIDED_INTAKE_AUDIENCE_PENDING_LIM],
      },
    };
    const { mergedResponses, extraction } = buildAudienceConfirmMergeAndExtraction(
      base,
      pending,
    );
    const ab = mergedResponses.audience_base as Record<string, unknown>;
    expect(ab.audience_type).toBe("b2b");
    expect(String(ab.audience_description_optional)).toMatch(/colegios/i);
    expect(String(ab.audience_description_optional)).toMatch(/padres/i);
    expect(extraction.user_intent).toBe("answer");
    const sb = mergedResponses.strategic_base as Record<string, unknown>;
    const lim = sb.guided_intake_limitations_optional as string[] | undefined;
    expect(lim ?? []).not.toContain(GUIDED_INTAKE_AUDIENCE_PENDING_LIM);
  });
});

describe("classifyPendingAudienceUserReply", () => {
  const pending = {
    version: 1 as const,
    primary_label: "Gerentes comerciales",
    secondary_label: "Usuarios del equipo de ventas",
    audience_type_hint: "b2b" as const,
  };

  it("prioritizes restart_strategic_audience over explicit_unclear when the user asks for Limbi’s read", () => {
    expect(
      classifyPendingAudienceUserReply("No estoy seguro, ¿a quién crees?", pending).kind,
    ).toBe("restart_strategic_audience");
  });

  it("treats naming the pending primary as confirmation (semantic)", () => {
    expect(classifyPendingAudienceUserReply("A los gerentes comerciales", pending).kind).toBe(
      "confirm",
    );
    expect(classifyPendingAudienceUserReply("gerentes comerciales", pending).kind).toBe(
      "confirm",
    );
    expect(classifyPendingAudienceUserReply("Ese orden está bien", pending).kind).toBe(
      "confirm",
    );
  });

  it("routes ‘no lo tengo claro’ to explicit_unclear (not a reject)", () => {
    expect(classifyPendingAudienceUserReply("No lo tengo claro", pending).kind).toBe(
      "explicit_unclear",
    );
    expect(detectAudienceExplicitUnclear("No estoy seguro")).toBe(true);
  });

  it("routes rejection / reorder to reject_priority without advancing", () => {
    expect(classifyPendingAudienceUserReply("no, prefiero otro orden", pending).kind).toBe(
      "reject_priority",
    );
    expect(classifyPendingAudienceUserReply("No", pending).kind).toBe("reject_priority");
  });

  it("when only the secondary actor is named, asks invert (does not confirm)", () => {
    const r = classifyPendingAudienceUserReply(
      "Usuarios del equipo de ventas",
      pending,
    );
    expect(r.kind).toBe("secondary_emphasis_invert_prompt");
  });

  it("reprompt path keeps a single surface question (no bank audience question)", () => {
    const amb = buildAudiencePendingAmbiguousTurnContent({
      pending,
      challengeType: "service",
      otherChallenge: false,
    });
    expect(amb.next_question).toBeNull();
    expect(amb.interviewer_message).toMatch(/¿Confirmas/i);
    expect(amb.interviewer_message).not.toMatch(/Volvamos a la pregunta/i);
  });
});

describe("pilot summary with audience_pending limitation", () => {
  it("does not show default B2B protagonist copy when audience is explicitly pending", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "x".repeat(20),
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional: "y".repeat(12),
        transformation_type: "understand_better",
        transformation_to: "z".repeat(14),
        guided_intake_limitations_optional: [GUIDED_INTAKE_AUDIENCE_PENDING_LIM],
      },
      audience_base: { audience_type: "b2b" },
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const s = buildStrategicInterviewPilotSummary(merged, "service", false, {});
    expect(s.body.toLowerCase()).not.toMatch(/b2b|empresa/);
    expect(s.body.toLowerCase()).not.toMatch(/consumidor/);
    expect(s.weakLine).toBeNull();
    expect(s.body).toMatch(/Confirmar audiencia|actores concretos/i);
  });

  it("uses indicios copy for inferred b2b slug without committed audience (pattern, not a fixed vertical)", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description:
          "Servicio para digitalizar expedientes y coordinar equipos en empresas medianas",
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional:
          "Equipos administrativos que aún trabajan con papel y versiones dispersas",
        transformation_type: "understand_better",
        transformation_to: "z".repeat(14),
      },
      audience_base: { audience_type: "b2b" },
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const s = buildStrategicInterviewPilotSummary(merged, "service", false, {
      "audience_base.audience_type": 0.72,
    });
    expect(s.body.toLowerCase()).not.toMatch(/protagonista principal/);
    expect(s.body).toMatch(/indicios de contexto organizacional/i);
  });

  it("adds cautious institutional hint only as pending copy, not as settled audience", () => {
    const merged: Record<string, unknown> = {
      strategic_base: {
        simple_description: "x".repeat(20),
        offering_type: "service",
        problem_category: "lack_clarity",
        problem_description_optional:
          "Programa con apoyo del gobierno municipal y hogares beneficiarios",
        transformation_type: "understand_better",
        transformation_to: "z".repeat(14),
        guided_intake_limitations_optional: [GUIDED_INTAKE_AUDIENCE_PENDING_LIM],
      },
      audience_base: {},
      evidence_base: { evidence_types: ["no_clear_evidence"] },
    };
    const s = buildStrategicInterviewPilotSummary(merged, "corporate_communication", false, {});
    expect(s.weakLine).toBeNull();
    expect(s.body).toMatch(/Confirmar audiencia|actores concretos/i);
    expect(s.body).toMatch(/institucional|impacto/i);
  });
});
