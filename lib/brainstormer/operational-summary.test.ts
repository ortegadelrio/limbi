import { describe, expect, it } from "vitest";
import {
  applyTurnSnapshotUpdate,
  isSnapshotNewer,
} from "@/lib/brainstormer/apply-turn-snapshot-update";
import { enrichSessionProgressFromDirector } from "@/lib/brainstormer/enrich-session-progress-from-director";
import {
  buildOperationalSummarySections,
  hasOperationalSummaryContent,
} from "@/lib/brainstormer/operational-summary";
import type { ConversationDirectorDecision } from "@/lib/brainstormer/conversation-director/types";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

function minimalDirector(
  overrides: Partial<ConversationDirectorDecision> = {},
): ConversationDirectorDecision {
  return {
    challenge_type: "positioning",
    user_intent: "explore",
    conversation_stage: "exploration",
    known_from_brand_base: [],
    missing_information: [],
    assistant_move: "give_hypothesis_then_question",
    next_best_question: "¿Cuál es la prioridad?",
    question_id: "test",
    question_asks_for: "perception_priority",
    question_reason: "Test",
    should_use_web_search: false,
    web_search_reason: null,
    should_suggest_project_conversion: false,
    project_readiness: "low",
    work_mode: "deliverable_building",
    concrete_deliverable_detected: true,
    detected_deliverable_type: "presentation",
    should_request_user_material: false,
    requested_material_reason: null,
    transition_message: null,
    world_cup_ip_guardrail: false,
    consulting_style_mode: "default",
    consulting_style_directive: "Test",
    user_insight_anchor: null,
    typo_avoid_terms: [],
    allow_structured_sections_list: false,
    user_selected_previous_option: false,
    selected_option_focus: null,
    option_advancement_directive: null,
    user_has_no_material: true,
    current_deliverable_type: "conference",
    current_deliverable_section: "El campo de juego",
    deliverable_build_depth: "section_draft",
    should_generate_content_now: true,
    deliverable_building_directive: null,
    ...overrides,
  };
}

describe("hasOperationalSummaryContent", () => {
  it("false cuando todo está vacío", () => {
    expect(hasOperationalSummaryContent(emptyBrainstormerSessionProgress())).toBe(false);
  });

  it("true cuando hay reto actual", () => {
    const p = emptyBrainstormerSessionProgress();
    p.current_challenge = "Posicionamiento para conferencias";
    expect(hasOperationalSummaryContent(p)).toBe(true);
  });
});

describe("buildOperationalSummarySections", () => {
  it("no incluye JSON: devuelve secciones con etiquetas", () => {
    const p = emptyBrainstormerSessionProgress();
    p.current_challenge = "Mejorar posicionamiento";
    p.next_step = "Desarrollar primera sección";
    const sections = buildOperationalSummarySections(p);
    expect(sections.some((s) => s.label === "Reto actual")).toBe(true);
    expect(sections.some((s) => s.label === "Siguiente paso")).toBe(true);
    expect(JSON.stringify(sections)).not.toContain('"current_challenge"');
  });
});

describe("enrichSessionProgressFromDirector", () => {
  it("rellena next_step y decisiones cuando el modelo deja campos vacíos", () => {
    const corpus =
      "user: conferencia de marketing con fútbol\nuser: no tengo notas\nuser: comencemos por el primero";
    const enriched = enrichSessionProgressFromDirector(
      emptyBrainstormerSessionProgress(),
      minimalDirector(),
      { conversation_excerpt: corpus, user_message: "desarróllamela" },
    );
    expect(enriched.next_step).toMatch(/campo de juego|sección/i);
    expect(enriched.ideas_explored).toMatch(/no tiene notas|desde cero/i);
    expect(enriched.current_challenge).toMatch(/conferencia/i);
  });
});

describe("applyTurnSnapshotUpdate", () => {
  it("actualiza payload local con session_progress del turno", () => {
    const progress = emptyBrainstormerSessionProgress();
    progress.current_challenge = "Reto actualizado";
    const snap = applyTurnSnapshotUpdate({
      previous: null,
      snapshotFromApi: undefined,
      sessionProgress: progress,
      sessionId: "sess-1",
      userId: "user-1",
    });
    expect(snap?.snapshot_payload).toEqual(progress);
  });

  it("prefiere snapshot de API si viene completo", () => {
    const apiSnap = {
      id: "snap-2",
      session_id: "sess-1",
      user_id: "user-1",
      snapshot_kind: "strategic_summary" as const,
      snapshot_payload: { current_challenge: "Desde API" },
      created_at: "2026-05-18T12:00:00.000Z",
    };
    const snap = applyTurnSnapshotUpdate({
      previous: null,
      snapshotFromApi: apiSnap,
      sessionProgress: emptyBrainstormerSessionProgress(),
      sessionId: "sess-1",
      userId: "user-1",
    });
    expect(snap?.id).toBe("snap-2");
  });
});

describe("isSnapshotNewer", () => {
  it("detecta snapshot más reciente por created_at", () => {
    const older = {
      id: "a",
      session_id: "s",
      user_id: "u",
      snapshot_kind: "strategic_summary" as const,
      snapshot_payload: {},
      created_at: "2026-05-18T10:00:00.000Z",
    };
    const newer = { ...older, id: "b", created_at: "2026-05-18T11:00:00.000Z" };
    expect(isSnapshotNewer(older, newer)).toBe(true);
  });
});
