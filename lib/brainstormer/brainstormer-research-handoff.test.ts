import { describe, expect, it, vi } from "vitest";
import {
  emptyBrainstormerWorkingBrief,
  updateBrainstormerWorkingBrief,
} from "@/lib/brainstormer/conversation-contract";
import { handleSpecialBrainstormerTurn } from "@/lib/brainstormer/handle-special-brainstormer-turn";
import { interpretBrainstormerTurnDeterministic } from "@/lib/brainstormer/interpret-brainstormer-turn";
import {
  evaluateProjectHandoffReadiness,
} from "@/lib/brainstormer/build-project-handoff-preview";
import {
  isExternalResearchRequest,
  isProjectHandoffRequest,
} from "@/lib/brainstormer/special-turn-detectors";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

vi.mock("@/lib/brainstormer/run-external-research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brainstormer/run-external-research")>();
  return {
    ...actual,
    runExternalResearch: vi.fn().mockResolvedValue({
      mode: "mock" as const,
      findings: [
        {
          query: "campañas parecidas",
          source_title: "[Modo prueba] Caso test",
          source_url: "limbi://research-mock",
          finding: "Hallazgo de prueba",
          strategic_reading: "Lectura de prueba",
          relevance: "Alta para test",
          approved_for_session: false,
        },
      ],
    }),
  };
});

describe("Research Mode bajo demanda", () => {
  it("«busca referentes de campañas parecidas» → external_research_request", () => {
    const msg = "busca referentes de campañas parecidas";
    expect(isExternalResearchRequest(msg)).toBe(true);
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.conversation_act).toBe("external_research_request");
    expect(interp.memory_update.update_umbrella).toBe(false);
  });

  it("«mira competidores» → external_research_request", () => {
    expect(isExternalResearchRequest("mira competidores")).toBe(true);
  });

  it("research no actualiza confirmed_conceptual_umbrella", async () => {
    const msg = "busca referentes de campañas parecidas";
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    const brief = updateBrainstormerWorkingBrief({
      prior: emptyBrainstormerWorkingBrief(),
      userMessage: msg,
      interpretation: interp,
    });
    expect(brief.confirmed_conceptual_umbrella).toBe("");

    const result = await handleSpecialBrainstormerTurn({
      interpretation: interp,
      last_user_message: msg,
      progress: emptyBrainstormerSessionProgress(),
      working_brief: brief,
      brand_name: "Boringstore",
    });
    expect(result.handled).toBe(true);
    expect(result.progress_patch.external_research_findings?.length).toBeGreaterThan(0);
    expect(
      result.progress_patch.external_research_findings?.every((f) => !f.approved_for_session),
    ).toBe(true);
    expect(result.assistant_message).toMatch(/incorporemos estos hallazgos/i);
    expect(result.structured_extra.research_mode).toBe("mock");
  });
});

describe("Handoff a Proyecto", () => {
  it("«Excelente, paso al módulo de proyectos ahora?» → project_handoff_request", () => {
    const msg = "Excelente, paso al módulo de proyectos ahora?";
    expect(isProjectHandoffRequest(msg)).toBe(true);
    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: emptyBrainstormerWorkingBrief(),
    });
    expect(interp.conversation_act).toBe("project_handoff_request");
    expect(interp.memory_update.update_umbrella).toBe(false);
  });

  it("handoff no repite respuesta de campaña — mensaje dedicado", async () => {
    const priorCampaignReply =
      "Yo trabajaría el sketch de producto falso como eje de expectativa para Boringstore.";
    const msg = "Excelente, paso al módulo de proyectos ahora?";
    const brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
    brief.conversion_bridge = "Producto falso → producto real en página";
    brief.campaign_stage = "expectativa";

    const progress = {
      ...emptyBrainstormerSessionProgress(),
      current_challenge: "Lanzar Boringstore con productos inverosímiles",
      preliminary_objective: "Atraer tráfico cualificado a la tienda",
      recommended_routes: "Expectativa con sketch y puente a compra",
      next_step: "Pasar a proyecto con mecanismo cerrado",
      audience_notes: "Compradores impulsivos de humor",
    };

    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: msg,
      working_brief: brief,
    });
    const result = await handleSpecialBrainstormerTurn({
      interpretation: interp,
      last_user_message: msg,
      progress,
      working_brief: brief,
      brand_name: "Boringstore",
    });

    expect(result.handled).toBe(true);
    expect(result.assistant_message).not.toBe(priorCampaignReply);
    expect(result.assistant_message).toMatch(/Proyecto|resumen/i);
    expect(result.assistant_message).not.toMatch(/Yo trabajaría el sketch/i);
  });

  it("con paraguas y mecanismo prepara handoff_preview", async () => {
    const brief = emptyBrainstormerWorkingBrief();
    brief.confirmed_conceptual_umbrella = "No sabías que lo querías";
    brief.conversion_bridge = "Producto falso abre; producto real cierra compra";
    const progress = {
      ...emptyBrainstormerSessionProgress(),
      current_challenge: "Lanzar tienda",
      preliminary_objective: "Adquisición digital",
      recommended_routes: "Expectativa + conversión en página",
      next_step: "Crear proyecto",
    };
    const readiness = evaluateProjectHandoffReadiness({
      progress,
      working_brief: brief,
      brand_name: "Boringstore",
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.preview?.confirmed_umbrella).toMatch(/no sab[ií]as/i);

    const interp = interpretBrainstormerTurnDeterministic({
      last_user_message: "pasemos a proyecto",
      working_brief: brief,
    });
    const result = await handleSpecialBrainstormerTurn({
      interpretation: interp,
      last_user_message: "pasemos a proyecto",
      progress,
      working_brief: brief,
      brand_name: "Boringstore",
    });
    expect(result.progress_patch.project_handoff_preview).toBeTruthy();
    expect(result.structured_extra.project_handoff_ready).toBe(true);
  });

  it("sin paraguas pide completar antes de pasar", async () => {
    const progress = {
      ...emptyBrainstormerSessionProgress(),
      current_challenge: "Lanzar tienda",
      preliminary_objective: "Adquisición",
      recommended_routes: "Ruta A",
      next_step: "Siguiente",
    };
    const result = await handleSpecialBrainstormerTurn({
      interpretation: interpretBrainstormerTurnDeterministic({
        last_user_message: "pasemos a proyecto",
        working_brief: emptyBrainstormerWorkingBrief(),
      }),
      last_user_message: "pasemos a proyecto",
      progress,
      working_brief: emptyBrainstormerWorkingBrief(),
      brand_name: "Boringstore",
    });
    expect(result.assistant_message).toMatch(/paraguas|Antes de pasar/i);
    expect(result.progress_patch.project_handoff_preview).toBeNull();
  });

  it("sin objetivo pide objetivo", () => {
    const readiness = evaluateProjectHandoffReadiness({
      progress: {
        ...emptyBrainstormerSessionProgress(),
        current_challenge: "Reto definido",
        preliminary_objective: "",
        recommended_routes: "Mecanismo X",
        next_step: "Paso",
      },
      working_brief: {
        ...emptyBrainstormerWorkingBrief(),
        confirmed_conceptual_umbrella: "No sabías que lo querías",
      },
      brand_name: "Boringstore",
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing.join(" ")).toMatch(/objetivo/i);
  });
});
