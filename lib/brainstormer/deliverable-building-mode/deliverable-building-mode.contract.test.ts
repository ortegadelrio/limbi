import { describe, expect, it } from "vitest";
import { formatConversationDirectionForPrompt } from "@/lib/brainstormer/conversational-renderer/format-conversation-direction-for-prompt";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import {
  detectContentGenerationRequest,
  detectUserDeclaredNoMaterial,
} from "@/lib/brainstormer/deliverable-building-mode/detect-deliverable-building";
import { emptyBrainstormerSessionProgress } from "@/lib/schemas/brainstormer-session";

const brandSignals = {
  identity_or_positioning: ["Estrategia de marketing con metáfora futbolera"],
  audiences: ["Líderes de marketing"],
  offer_or_roles: ["Conferencias"],
  differentiators: [],
  credibility_assets: [],
  tone_or_limbic_cues: [],
  guardrails: [],
};

function conferenceExcerpt(extra = ""): string {
  return `user: Quiero una conferencia de estrategia de marketing con analogía futbolera.

assistant: Te propongo esta estructura narrativa:
1. El campo de juego: la marca y su entorno competitivo
2. El entrenador: el rol del líder de marketing
3. La táctica: decisiones estratégicas bajo presión

user: Me gustaría primero tener una estructura de la conferencia.

assistant: Perfecto. Las secciones quedan así…

${extra}`.trim();
}

function director(userMessage: string, excerpt: string) {
  const progress = emptyBrainstormerSessionProgress();
  return resolveConversationDirector({
    user_message: userMessage,
    conversation_excerpt: excerpt,
    session_progress: {
      session_summary: progress.session_summary,
      current_challenge: "Conferencia marketing fútbol",
      preliminary_objective: progress.preliminary_objective,
      project_readiness: progress.project_readiness,
      should_suggest_project_conversion: progress.should_suggest_project_conversion,
    },
    brand_signals: brandSignals,
    user_message_count: 4,
  });
}

describe("detectUserDeclaredNoMaterial", () => {
  it('marca user_has_no_material con "no tengo notas"', () => {
    expect(detectUserDeclaredNoMaterial("user: no tengo notas")).toBe(true);
    const d = director("siguiente", conferenceExcerpt("user: no tengo notas"));
    expect(d.user_has_no_material).toBe(true);
  });

  it('marca user_has_no_material con "no tengo nada"', () => {
    expect(detectUserDeclaredNoMaterial("no tengo nada")).toBe(true);
  });
});

describe("resolveConversationDirector — BRAIN-12", () => {
  const excerptWithNoMaterial = conferenceExcerpt(
    "user: no tengo notas\n\nuser: no tengo nada",
  );

  it("no vuelve a pedir notas si el usuario ya dijo que no tiene", () => {
    const d = director(
      "¿y ahora qué hacemos?",
      excerptWithNoMaterial,
    );
    expect(d.user_has_no_material).toBe(true);
    expect(d.should_request_user_material).toBe(false);
    expect(d.next_best_question.toLowerCase()).not.toMatch(/notas|pegar|subir|word|pdf/);
    expect(d.deliverable_building_directive ?? "").toMatch(/NO tiene notas/i);
  });

  it('"desarróllamela" activa should_generate_content_now', () => {
    expect(detectContentGenerationRequest("Nada, desarróllamela por favor")).toBe(true);
    const d = director(
      "Nada, desarróllamela por favor",
      `${excerptWithNoMaterial}\n\nuser: comencemos por el primero`,
    );
    expect(d.should_generate_content_now).toBe(true);
    expect(d.user_intent).toBe("build_deliverable_content");
    expect(d.deliverable_build_depth).toBe("section_draft");
    expect(d.assistant_move).toBe("propose_micro_plan");
  });

  it("conferencia + sección actual → renderer recibe borrador de sección", () => {
    const d = director(
      "desarróllamela por favor",
      `${excerptWithNoMaterial}\n\nuser: comencemos por el primero\n\nassistant: Empecemos por el campo de juego…`,
    );
    expect(d.current_deliverable_type).toBe("conference");
    expect(d.current_deliverable_section).toMatch(/campo de juego/i);
    expect(d.deliverable_building_directive).toMatch(/BORRADOR REAL/i);
    expect(d.allow_structured_sections_list).toBe(true);

    const block = formatConversationDirectionForPrompt(d);
    expect(block).toContain("should_generate_content_now: true");
    expect(block).toContain("SECTION DRAFT (mandatory)");
    expect(block).toMatch(/150–280/);
  });

  it("no sugiere FODA por defecto (solo lo prohíbe si aparece)", () => {
    const d = director("desarróllamela", excerptWithNoMaterial);
    expect(d.next_best_question).not.toMatch(/\bFODA\b/i);
    expect(d.deliverable_building_directive).toMatch(/PROHIBIDO.*FODA/i);
  });

  it("no usa lenguaje débil en la directiva de construcción", () => {
    const d = director("desarróllamela", excerptWithNoMaterial);
    const directive = d.deliverable_building_directive ?? "";
    expect(directive).toMatch(/podrías|sería útil|profundizar/i);
    expect(directive).toMatch(/PROHIBIDO/i);
  });

  it("después del borrador, una sola pregunta de tono o siguiente sección", () => {
    const d = director("desarróllamela", excerptWithNoMaterial);
    expect(d.next_best_question).toMatch(/siguiente sección|mismo tono/i);
    expect(d.question_id).toBe("brain12-section-draft-followup");
    const block = formatConversationDirectionForPrompt(d);
    expect(block).toMatch(/ONE closing question/i);
  });

  it('"comencemos por el primero" activa generación de contenido', () => {
    const d = director("comencemos por el primero", excerptWithNoMaterial);
    expect(d.should_generate_content_now).toBe(true);
    expect(d.current_deliverable_section).toMatch(/campo de juego/i);
  });
});
