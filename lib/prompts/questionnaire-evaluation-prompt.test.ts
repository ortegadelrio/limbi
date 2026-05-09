import { describe, expect, it } from "vitest";
import { stripInternalResponseKeys } from "@/lib/master-document/responses-public";
import { LIMBIC_INTERVIEW_TRACE_KEY } from "@/lib/intake/orchestrator";
import { buildQuestionnaireEvaluationPrompt } from "@/lib/prompts/questionnaire-evaluation";

describe("buildQuestionnaireEvaluationPrompt", () => {
  const base = {
    project_summary: { id: "p1" },
    responses_json: '{"strategic_base":{"simple_description":"hola"}}',
  };

  it("includes guided post-capture deepening instructions when flag is true", () => {
    const prompt = buildQuestionnaireEvaluationPrompt({
      ...base,
      guided_strategic_intake_post_capture: true,
    });
    expect(prompt).toContain("GUIDED_STRATEGIC_INTAKE_POST_CAPTURE");
    expect(prompt).toContain("multiple audience actors");
    expect(prompt).toContain("tangible proofs");
    expect(prompt).toContain("promised benefit or transformation");
    expect(prompt).toMatch(/concrete, actionable suggestions/i);
  });

  it("omits guided post-capture block when flag is false or omitted", () => {
    const a = buildQuestionnaireEvaluationPrompt({
      ...base,
      guided_strategic_intake_post_capture: false,
    });
    const b = buildQuestionnaireEvaluationPrompt({ ...base });
    expect(a).not.toContain("GUIDED_STRATEGIC_INTAKE_POST_CAPTURE");
    expect(b).not.toContain("GUIDED_STRATEGIC_INTAKE_POST_CAPTURE");
  });

  it("STRUCTURED_RESPONSES_JSON can omit underscore-prefixed trace keys (parity with evaluate route)", () => {
    const merged = {
      strategic_base: { simple_description: "Colegios y familias" },
      [LIMBIC_INTERVIEW_TRACE_KEY]: {
        version: 1,
        pilot_id: "strategic_interview_v1",
        phase: "done",
        mini_step: "complete",
        follow_up_used: false,
        turns: [{ at: "t", role: "user", summary: "secret" }],
      },
    };
    const prompt = buildQuestionnaireEvaluationPrompt({
      project_summary: { id: "p1" },
      responses_json: JSON.stringify(
        stripInternalResponseKeys(merged),
        null,
        2,
      ),
      guided_strategic_intake_post_capture: true,
    });
    expect(prompt).not.toContain(LIMBIC_INTERVIEW_TRACE_KEY);
    expect(prompt).toContain("Colegios y familias");
  });
});
