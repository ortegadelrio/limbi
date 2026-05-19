import { describe, expect, it } from "vitest";
import { buildQuestionReason } from "@/lib/brainstormer/question-engine/build-question-reason";

describe("buildQuestionReason", () => {
  it("explica sales_gap en ventas", () => {
    const reason = buildQuestionReason({
      asks_for: "sales_gap",
      challenge_type: "sales",
      assistant_move: "ask_one_strategic_question",
      missing_information: ["Meta de ventas / boletas", "Plazo"],
    });
    expect(reason).toMatch(/meta faltante y el plazo/i);
  });

  it("incluye prefijo de hipótesis en posicionamiento", () => {
    const reason = buildQuestionReason({
      asks_for: "perception_priority",
      challenge_type: "positioning",
      assistant_move: "give_hypothesis_then_question",
      missing_information: ["Prioridad del posicionamiento"],
    });
    expect(reason).toMatch(/hipótesis con evidencia/i);
    expect(reason).toMatch(/priorizar|territorio/i);
  });
});
