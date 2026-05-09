import {
  guidedIntakeEvaluateQuestionnaireUrl,
  guidedIntakeQuestionnaireClarifyPath,
} from "@/lib/intake/guided-intake-diagnosis-copy";

export type RunGuidedIntakeInitialQuestionnaireDiagnosisResult =
  | { ok: true; clarifyPath: string }
  | { ok: false; errorMessage: string };

/**
 * POST questionnaire evaluation after first capture, then navigate to clarify.
 * Side-effect free except `fetch`; caller performs navigation on `ok`.
 */
export async function runGuidedIntakeInitialQuestionnaireDiagnosis(params: {
  projectId: string;
  fetchImpl?: typeof fetch;
}): Promise<RunGuidedIntakeInitialQuestionnaireDiagnosisResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const evRes = await fetchImpl(guidedIntakeEvaluateQuestionnaireUrl(params.projectId), {
    method: "POST",
    credentials: "include",
  });
  const evJson = (await evRes.json().catch(() => ({}))) as { error?: unknown };
  if (!evRes.ok) {
    return {
      ok: false,
      errorMessage:
        typeof evJson.error === "string"
          ? evJson.error
          : "No se pudo ejecutar el diagnóstico inicial.",
    };
  }
  return { ok: true, clarifyPath: guidedIntakeQuestionnaireClarifyPath(params.projectId) };
}
