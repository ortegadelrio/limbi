import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import type { LimbicInterviewTraceV1 } from "@/lib/intake/orchestrator";
import type { StrategicInterviewPilotSummary } from "@/lib/intake/strategic-interview-summary";
import type { SegmentConfirmationUiPayloadV1 } from "@/lib/intake/segment-confirmation-ui";

/** Client-side ceiling so the pilot never stays in “thinking” indefinitely. */
export const INTAKE_TURN_TIMEOUT_MS = 90_000;

export type IntakeTurnResponse = {
  extraction: IntakeExtractionOutput;
  trace: LimbicInterviewTraceV1;
  follow_up_question: string | null;
  suggested_chips: string[];
  summary: StrategicInterviewPilotSummary | null;
  interviewer_message: string | null;
  next_question: string | null;
  project_challenge_type: string | null;
  should_not_advance?: boolean;
  segment_confirmation_ui?: SegmentConfirmationUiPayloadV1 | null;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function parseSegmentConfirmationUi(
  raw: unknown,
): SegmentConfirmationUiPayloadV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== 1) return null;
  if (typeof raw.synthesis !== "string" || !raw.synthesis.trim()) return null;
  if (!Array.isArray(raw.actions)) return null;
  const actions = raw.actions.filter(
    (a): a is SegmentConfirmationUiPayloadV1["actions"][number] =>
      isPlainObject(a) &&
      typeof (a as { id?: unknown }).id === "string" &&
      typeof (a as { label?: unknown }).label === "string",
  );
  if (actions.length < 1) return null;
  return { version: 1, synthesis: raw.synthesis.trim(), actions };
}

/**
 * Validates the intake-turn JSON envelope so the UI can fail softly without breaking React state.
 */
export function parseIntakeTurnResponseOrThrow(raw: unknown): IntakeTurnResponse {
  if (!isPlainObject(raw)) {
    throw new Error("Respuesta inesperada del servidor (formato inválido).");
  }
  if (typeof raw.error === "string" && raw.error.trim() && !isPlainObject(raw.trace)) {
    throw new Error(raw.error.trim());
  }
  if (!isPlainObject(raw.trace)) {
    throw new Error("Respuesta inesperada del servidor (sin estado de entrevista).");
  }
  if (!isPlainObject(raw.extraction)) {
    throw new Error("Respuesta inesperada del servidor (sin extracción).");
  }
  const tr = raw.trace as Record<string, unknown>;
  if (tr.version !== 1) {
    throw new Error("Respuesta inesperada del servidor (versión de trazas no reconocida).");
  }
  const ex = raw.extraction as Record<string, unknown>;
  if (typeof ex.needs_follow_up !== "boolean") {
    throw new Error("Respuesta inesperada del servidor (extracción incompleta).");
  }

  const segment_confirmation_ui = parseSegmentConfirmationUi(
    (raw as { segment_confirmation_ui?: unknown }).segment_confirmation_ui,
  );

  return {
    extraction: raw.extraction as IntakeExtractionOutput,
    trace: raw.trace as LimbicInterviewTraceV1,
    follow_up_question:
      typeof raw.follow_up_question === "string" ? raw.follow_up_question : null,
    suggested_chips: Array.isArray(raw.suggested_chips)
      ? raw.suggested_chips.filter((x): x is string => typeof x === "string")
      : [],
    summary: (raw.summary ?? null) as StrategicInterviewPilotSummary | null,
    interviewer_message:
      typeof raw.interviewer_message === "string" ? raw.interviewer_message : null,
    next_question: typeof raw.next_question === "string" ? raw.next_question : null,
    project_challenge_type:
      typeof raw.project_challenge_type === "string"
        ? raw.project_challenge_type
        : null,
    should_not_advance: raw.should_not_advance === true,
    ...(segment_confirmation_ui ? { segment_confirmation_ui } : {}),
  };
}
