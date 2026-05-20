import { describe, expect, it } from "vitest";
import { resolveConversationDirector } from "@/lib/brainstormer/conversation-director/resolve-conversation-director";
import {
  CONFERENCE_NARRATIVE_SECTIONS_ES,
  CONSULTING_WEAK_PHRASES_ES,
  detectConsultingStyle,
  detectNeedsClarity,
  detectStrongUserIdea,
  detectTypoAvoidTerms,
} from "@/lib/brainstormer/consulting-style";
import { BRAINSTORMER_CORE_BEHAVIOR_ES } from "@/lib/brainstormer/brainstormer-core-behavior";
import { buildConversationalRendererSystemInstructions } from "@/lib/brainstormer/conversational-renderer";
import { formatConversationDirectionForPrompt } from "@/lib/brainstormer/conversational-renderer/format-conversation-direction-for-prompt";
const emptySignals = {
  identity_or_positioning: ["Estratega de marketing"],
  audiences: ["Líderes empresariales"],
  offer_or_roles: ["Consultoría", "Conferencias"],
  differentiators: [],
  credibility_assets: [],
  tone_or_limbic_cues: [],
  guardrails: [],
};

describe("BRAIN-10 — No entiendo → reparación simple", () => {
  it("detecta needs_clarity y directiva de reparación", () => {
    expect(detectNeedsClarity("No entiendo")).toBe(true);

    const style = detectConsultingStyle({
      user_message: "No entiendo",
      conversation_excerpt: "user: Quiero mejorar mi posicionamiento\nassistant: Mi hipótesis es que…",
      challenge_type: "positioning",
    });

    expect(style.consulting_style_mode).toBe("repair_confusion");
    expect(style.consulting_style_directive).toMatch(/enredado|reparación|simple/i);
    expect(style.preferred_closing_question).toMatch(/consultorías|conferencias|asesorías/i);
  });

  it("integración director: user_intent needs_clarity + repair_and_reframe", () => {
    const d = resolveConversationDirector({
      user_message: "No entiendo",
      conversation_excerpt: "user: Quiero mejorar mi posicionamiento de marca personal",
      session_progress: {
        session_summary: "",
        current_challenge: "Posicionamiento",
        preliminary_objective: "",
        project_readiness: "low",
        should_suggest_project_conversion: false,
      },
      brand_signals: emptySignals,
      user_message_count: 2,
    });

    expect(d.user_intent).toBe("needs_clarity");
    expect(d.assistant_move).toBe("repair_and_reframe");
    expect(d.consulting_style_mode).toBe("repair_confusion");
    expect(d.next_best_question).toMatch(/consultorías|conferencias|asesorías/i);
  });
});

describe("BRAIN-10 — Idea potente del usuario", () => {
  it("nombra el eje de individualidades y rendimiento colectivo", () => {
    const msg =
      "Creo que un equipo debe entrenar individualidades que luego juntas forman un equipo ganador";
    const insight = detectStrongUserIdea(msg, "");
    expect(insight).toMatch(/individualidades|talento disperso|rendimiento colectivo/i);

    const style = detectConsultingStyle({
      user_message: msg,
      conversation_excerpt: "",
      challenge_type: "positioning",
    });
    expect(style.consulting_style_mode).toBe("name_strong_idea");
    expect(style.consulting_style_directive).toMatch(/eje fuerte|Mi lectura/i);
    expect(style.user_insight_anchor).toBeTruthy();
  });
});

describe("BRAIN-10 — Typos: no repetir papalelo", () => {
  it("detecta papalelo en typo_avoid_terms", () => {
    const terms = detectTypoAvoidTerms("Quiero un papalelo con el mundial");
    expect(terms).toContain("papalelo");
  });

  it("la directiva prohíbe repetir el typo", () => {
    const style = detectConsultingStyle({
      user_message: "Algo en papalelo con fútbol",
      conversation_excerpt: "",
      challenge_type: "general_strategy",
    });
    expect(style.typo_avoid_terms).toContain("papalelo");
    expect(style.consulting_style_directive).toMatch(/No repetir|typos|papalelo/i);
  });
});

describe("BRAIN-10 — Evitar lenguaje débil", () => {
  it("el contrato lista frases débiles y el core behavior las prohíbe", () => {
    expect(CONSULTING_WEAK_PHRASES_ES).toContain("podrías");
    expect(CONSULTING_WEAK_PHRASES_ES).toContain("sería útil");

    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/qué opinas/i);
    expect(BRAINSTORMER_CORE_BEHAVIOR_ES).toMatch(/Toma postura/i);

    const renderer = buildConversationalRendererSystemInstructions();
    expect(renderer).toContain("BRAINSTORMER CORE BEHAVIOR");
  });
});

describe("BRAIN-10 — Conferencia + notas", () => {
  it("estructura provisional + pedir notas", () => {
    const style = detectConsultingStyle({
      user_message:
        "Me puedes dar los puntos, o mejor, las secciones de la conferencia cómo serían? yo tengo ya algunas notas",
      conversation_excerpt: "user: conferencia liderazgo y fútbol mundial",
      challenge_type: "positioning",
    });

    expect(style.consulting_style_mode).toBe("conference_structure_with_notes");
    expect(style.allow_structured_sections_list).toBe(true);
    expect(style.consulting_style_directive).toMatch(/PROVISIONAL|notas/i);
    expect(style.preferred_closing_question).toMatch(/notas|pegar/i);
  });
});

describe("BRAIN-10 — Estructura de conferencia no genérica", () => {
  it("el esqueleto narrativo incluye metáfora futbolera y arco completo", () => {
    expect(CONFERENCE_NARRATIVE_SECTIONS_ES.length).toBeGreaterThanOrEqual(7);
    expect(CONFERENCE_NARRATIVE_SECTIONS_ES.join(" ")).toMatch(/fútbol|individualidades|director técnico/i);
    expect(CONFERENCE_NARRATIVE_SECTIONS_ES.join(" ")).not.toMatch(/introducción.*desarrollo.*conclusión/i);
  });

  it("CONVERSATION_DIRECTION incluye bloque consulting_style", () => {
    const d = resolveConversationDirector({
      user_message:
        "Dame las secciones de la conferencia, tengo notas en Word",
      conversation_excerpt: "user: conferencia mundial liderazgo",
      session_progress: {
        session_summary: "",
        current_challenge: "Conferencia",
        preliminary_objective: "",
        project_readiness: "low",
        should_suggest_project_conversion: false,
      },
      brand_signals: emptySignals,
      user_message_count: 3,
    });

    const block = formatConversationDirectionForPrompt(d);
    expect(block).toContain("CONSULTING_STYLE");
    expect(block).toContain("conference_structure_with_notes");
    expect(block).toContain("allow_structured_sections_list: true");
    expect(d.consulting_style_directive).toMatch(/El partido que juegan hoy las empresas/i);
  });
});
