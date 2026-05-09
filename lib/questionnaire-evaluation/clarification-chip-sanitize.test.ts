import { describe, expect, it } from "vitest";
import {
  detectProjectChipCategory,
  getContextualUniversalSkipOptions,
  injectUniversalClarificationSkips,
  sanitizeClarificationQuestionChips,
} from "@/lib/questionnaire-evaluation/clarification-chip-sanitize";
import { CLARIFICATION_SKIP_NOT_AVAILABLE_ID } from "@/lib/questionnaire-evaluation/clarification-skip-constants";
import { mergeClarificationSuggestionChips } from "@/lib/questionnaire-evaluation/clarification-ui-suggestions";
import type { ClarificationQuestion } from "@/lib/questionnaire-evaluation/schema";

describe("sanitizeClarificationQuestionChips", () => {
  it("does not surface wellness transformation chips for a cocktails consumer experience question", () => {
    const responses: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Bar de cocktails de autor y eventos privados.",
      },
    };
    const q: ClarificationQuestion = {
      id: "q_cocktail_exp",
      referenced_user_answer: "Buscas destacar en una ciudad con mucha oferta.",
      why_it_matters: "Define el tono de la promesa al público.",
      question_text:
        "¿Qué experiencia memorable quieres que viva el consumidor con tus cocktails?",
      options: [
        { id: "bad1", label: "Más calma" },
        { id: "bad2", label: "Menos ansiedad" },
        { id: "bad3", label: "Mejor convivencia" },
      ],
      allow_free_text: true,
    };
    const out = sanitizeClarificationQuestionChips(q, responses);
    const labels = (out.options ?? []).map((o) => o.label).join(" | ");
    expect(labels.toLowerCase()).not.toMatch(/\bcalma\b/);
    expect(labels.toLowerCase()).not.toMatch(/\bansiedad\b/);
    expect(labels.toLowerCase()).not.toMatch(/\bconvivencia\b/);
    expect(labels.toLowerCase()).toMatch(/sabor|momento|social|premium|descubrimiento|celebraci|compartir/i);
  });

  it("keeps wellness-oriented chips for yoga / wellbeing questions", () => {
    const responses: Record<string, unknown> = {
      strategic_base: {
        simple_description: "Yoga para niños en colegios con padres y educadoras.",
      },
    };
    const q: ClarificationQuestion = {
      id: "q_yoga",
      referenced_user_answer: "Quieren más calma en el aula.",
      why_it_matters: "Alinea promesa con lo que buscan las familias.",
      question_text:
        "¿Qué cambio concreto esperas que perciban los participantes después de la clase?",
      options: [{ id: "x", label: "Otro matiz" }],
      allow_free_text: true,
    };
    const out = sanitizeClarificationQuestionChips(q, responses);
    const labels = (out.options ?? []).map((o) => o.label).join(" | ");
    expect(detectProjectChipCategory(responses)).toBe("wellness_yoga");
    expect(labels.toLowerCase()).toMatch(/\bcalma\b|\bansiedad\b|\bconvivencia\b/);
  });

  it("uses contextual universal skip labels for evidence questions", () => {
    const q: ClarificationQuestion = {
      id: "q_ev",
      referenced_user_answer: "Aún no hay pruebas concretas registradas.",
      why_it_matters: "Evita afirmaciones fuertes sin respaldo.",
      question_text: "¿Qué evidencia real puedes usar hoy para sostener tu propuesta?",
      allow_free_text: true,
    };
    const merged = mergeClarificationSuggestionChips(q, {});
    const notAvail = merged.options?.find((o) => o.id === CLARIFICATION_SKIP_NOT_AVAILABLE_ID);
    expect(notAvail?.label).toBe("No tengo evidencia todavía");
    expect(getContextualUniversalSkipOptions("evidence")[0]?.label).toBe(
      "No tengo evidencia todavía",
    );
  });

  it("does not use generic 'No tengo esta información todavía' for evidence skips", () => {
    const q: ClarificationQuestion = {
      id: "q_ev2",
      referenced_user_answer: "Contexto.",
      why_it_matters: "Importa.",
      question_text: "¿Qué pruebas o casos puedes compartir?",
      allow_free_text: true,
    };
    const out = injectUniversalClarificationSkips(q);
    const labels = (out.options ?? []).map((o) => o.label).join(" | ");
    expect(labels).not.toMatch(/No tengo esta información todavía/);
    expect(labels).toMatch(/No tengo evidencia todavía/);
  });
});
