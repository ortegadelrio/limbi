import { describe, expect, it, vi } from "vitest";
import { guidedIntakeEvaluateQuestionnaireUrl } from "@/lib/intake/guided-intake-diagnosis-copy";
import { runGuidedIntakeInitialQuestionnaireDiagnosis } from "@/lib/intake/guided-intake-initial-questionnaire-diagnosis";

describe("runGuidedIntakeInitialQuestionnaireDiagnosis", () => {
  it("POSTs evaluate-questionnaire and returns clarify path on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const result = await runGuidedIntakeInitialQuestionnaireDiagnosis({
      projectId: "proj-xyz",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clarifyPath).toBe("/projects/proj-xyz/questionnaire-clarify");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(guidedIntakeEvaluateQuestionnaireUrl("proj-xyz"));
    expect(url).toMatch(/\/api\/projects\/proj-xyz\/evaluate-questionnaire$/);
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
  });

  it("returns an error result when the API responds non-OK", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "falló" }),
    });
    const result = await runGuidedIntakeInitialQuestionnaireDiagnosis({
      projectId: "p1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toBe("falló");
    }
  });
});
