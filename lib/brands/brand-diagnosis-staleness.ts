import type { BrandEvaluationRow } from "@/types/database";

type TimestampRow = {
  updated_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
};

type DiagnosisStalenessInput = {
  evaluation: Pick<BrandEvaluationRow, "created_at"> | null;
  responseRows?: Pick<TimestampRow, "updated_at">[];
  sourceFactRows?: Pick<TimestampRow, "reviewed_at" | "updated_at">[];
  improvementRows?: Pick<TimestampRow, "approved_at">[];
};

export function isAfterEvaluationCreatedAt(
  evaluation: Pick<BrandEvaluationRow, "created_at"> | null,
  timestamp: string | null | undefined,
): boolean {
  return Boolean(evaluation?.created_at && timestamp && timestamp > evaluation.created_at);
}

export function isBrandDiagnosisStale({
  evaluation,
  responseRows = [],
  sourceFactRows = [],
  improvementRows = [],
}: DiagnosisStalenessInput): boolean {
  if (!evaluation) return false;

  return (
    responseRows.some((row) => isAfterEvaluationCreatedAt(evaluation, row.updated_at)) ||
    sourceFactRows.some(
      (row) =>
        isAfterEvaluationCreatedAt(evaluation, row.reviewed_at) ||
        isAfterEvaluationCreatedAt(evaluation, row.updated_at),
    ) ||
    improvementRows.some((row) => isAfterEvaluationCreatedAt(evaluation, row.approved_at))
  );
}
