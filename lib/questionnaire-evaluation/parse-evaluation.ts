import {
  questionnaireEvaluationPayloadSchema,
  type QuestionnaireEvaluationPayload,
} from "@/lib/questionnaire-evaluation/schema";
import { stripJsonFence } from "@/lib/master-document/validate-openai-json";

function normalizeDimensionScores(
  root: Record<string, unknown>,
): Record<string, unknown> {
  const raw = root.dimension_scores;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    root.dimension_scores = {};
    return root;
  }
  const ds = raw as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ds)) {
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string" && v.trim() !== ""
          ? Number(v)
          : NaN;
    if (typeof n === "number" && Number.isFinite(n)) {
      next[k] = Math.max(0, Math.min(100, Math.round(n)));
    }
  }
  root.dimension_scores = next;
  return root;
}

export function parseQuestionnaireEvaluationJson(rawText: string):
  | { ok: true; data: QuestionnaireEvaluationPayload }
  | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(rawText));
  } catch {
    return { ok: false, message: "El modelo no devolvió JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "El JSON raíz debe ser un objeto." };
  }
  const root = normalizeDimensionScores({ ...(parsed as Record<string, unknown>) });

  if (
    !root.dimension_scores ||
    typeof root.dimension_scores !== "object" ||
    Array.isArray(root.dimension_scores) ||
    Object.keys(root.dimension_scores as object).length === 0
  ) {
    return {
      ok: false,
      message: "Faltan dimension_scores con al menos una dimensión.",
    };
  }

  const r = questionnaireEvaluationPayloadSchema.safeParse(root);
  if (!r.success) {
    return {
      ok: false,
      message: r.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { ok: true, data: r.data };
}
