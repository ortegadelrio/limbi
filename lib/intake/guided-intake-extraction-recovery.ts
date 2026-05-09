import type { GuidedMiniStepId } from "@/lib/intake/guided-interview-flow";
import { explicitEvidenceAbsenceDeclaration } from "@/lib/intake/guided-intake-evidence-input-classifier";
import { inferWizardEvidenceTypesFromProofNarrative } from "@/lib/intake/guided-intake-evidence-narrative";
import type { IntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { parseIntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { evidenceBaseNoClearPatch } from "@/lib/intake/strategic-interview-apply";
import type { GuidedIntakeExtractionJsonResult } from "@/lib/openai/guided-intake-extraction";

export const EXTRACTION_USER_RECOVERY_NOTICE =
  "Tu respuesta sí sirve. Estoy teniendo problemas para ordenarla automáticamente, así que la guardaré como información pendiente y seguiremos afinando.";

export const EXTRACTION_LIMBI_FALLBACK_CONTINUATION =
  "Entiendo la idea general, aunque todavía falta ordenarla mejor. La dejo guardada como base inicial y seguimos con la siguiente pregunta.";

export function combinedFallbackInterviewerMessage(): string {
  return `${EXTRACTION_USER_RECOVERY_NOTICE}\n\n${EXTRACTION_LIMBI_FALLBACK_CONTINUATION}`;
}

export function logGuidedIntakeExtractionFailure(params: {
  stage: string;
  mini_step: string;
  challenge_type: string | null;
  raw_model_output: string;
  validation_error: string;
  user_answer_length: number;
  model_used: string;
}): void {
  const safeRaw = params.raw_model_output.slice(0, 12_000);
  console.error(
    "[guided-intake:extraction_failure]",
    JSON.stringify({ ...params, raw_model_output: safeRaw }),
  );
}

export function buildRepairExtractionInput(params: {
  system: string;
  schemaHint: string;
  originalUserPrompt: string;
  validationErrorSummary: string;
  invalidRawJson: string;
}): string {
  const truncatedInvalid = params.invalidRawJson.slice(0, 8000);
  return `${params.system}

You are repairing a FAILED extraction JSON. Output ONE JSON object ONLY (no markdown fences, no commentary).
The previous output failed validation with this summary:
${params.validationErrorSummary}

Rules:
- Match the schema exactly (all required keys, correct enum strings for answer_status and user_intent including strategic_validation_question, boolean needs_follow_up, public_copy_allowed).
- interviewer_message must be a non-empty Spanish string, user-facing only.
- suggested_answer_chips must be an array (use [] if none).
- target_response_paths must be an array of strings (use [] if unsure).

Invalid output to fix (may be truncated):
${truncatedInvalid}

Schema reminder:
${params.schemaHint}

Original interview context (preserve user meaning):
${params.originalUserPrompt}
`.trim();
}

function mergeLim(
  prev: string[],
  extra: string[],
): string[] {
  return [...prev, ...extra];
}

/**
 * Deterministic extraction when the model output cannot be validated.
 * Safe for persistence; low confidence; never blocks the interview.
 */
export function buildDeterministicFallbackExtraction(
  miniStep: GuidedMiniStepId,
  userText: string,
  prevLimitations: string[],
): IntakeExtractionOutput {
  const clean = userText.trim().slice(0, 4000);
  const low = 0.28;
  const interviewer = combinedFallbackInterviewerMessage();
  const baseNotes =
    "deterministic_fallback_extraction: model JSON failed validation or parse; safe fields only.";

  if (miniStep === "tailored_what") {
    const lim = mergeLim(prevLimitations, [
      "guided_intake:fallback_tailored_what",
    ]);
    const desc =
      clean ||
      "Pendiente de afinar: guardé tu respuesta para ordenarla mejor en los siguientes pasos.";
    return {
      extracted_response_updates: {
        strategic_base: {
          simple_description: desc,
          guided_intake_limitations_optional: lim,
        },
      },
      confidence_by_field: {
        "strategic_base.simple_description": low,
      },
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "fallback_saved",
      target_response_paths: [
        "strategic_base.simple_description",
        "strategic_base.guided_intake_limitations_optional",
      ],
      internal_notes: `${baseNotes} mini_step=tailored_what`,
      interviewer_message: interviewer,
      public_copy_allowed: false,
      user_intent: "answer",
    };
  }

  if (miniStep === "problem") {
    const lim = mergeLim(prevLimitations, ["guided_intake:fallback_problem"]);
    return {
      extracted_response_updates: {
        strategic_base: {
          problem_description_optional: clean || null,
          guided_intake_limitations_optional: lim,
        },
      },
      confidence_by_field: {
        "strategic_base.problem_description_optional": low,
      },
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "fallback_saved",
      target_response_paths: [
        "strategic_base.problem_description_optional",
        "strategic_base.guided_intake_limitations_optional",
      ],
      internal_notes: `${baseNotes} mini_step=problem`,
      interviewer_message: interviewer,
      public_copy_allowed: false,
      user_intent: "answer",
    };
  }

  if (miniStep === "transformation") {
    const lim = mergeLim(prevLimitations, [
      "guided_intake:transformation_fallback_pending",
    ]);
    return {
      extracted_response_updates: {
        strategic_base: {
          transformation_to: clean || null,
          transformation_from: null,
          guided_intake_limitations_optional: lim,
        },
      },
      confidence_by_field: {
        "strategic_base.transformation_to": low,
      },
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "fallback_saved",
      target_response_paths: [
        "strategic_base.transformation_to",
        "strategic_base.guided_intake_limitations_optional",
      ],
      internal_notes: `${baseNotes} mini_step=transformation`,
      interviewer_message: interviewer,
      public_copy_allowed: false,
      user_intent: "answer",
    };
  }

  if (miniStep === "audience") {
    return {
      extracted_response_updates: {
        audience_base: {
          audience_description_optional: clean || null,
        },
      },
      confidence_by_field: {
        "audience_base.audience_description_optional": low,
      },
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "fallback_saved",
      target_response_paths: ["audience_base.audience_description_optional"],
      internal_notes: `${baseNotes} mini_step=audience`,
      interviewer_message: interviewer,
      public_copy_allowed: false,
      user_intent: "answer",
    };
  }

  if (miniStep === "evidence") {
    const noEvidence = explicitEvidenceAbsenceDeclaration(clean);
    const lim = mergeLim(prevLimitations, [
      noEvidence
        ? "guided_intake:fallback_evidence_none_declared"
        : `guided_intake:fallback_evidence_note:${clean.slice(0, 400)}`,
    ]);
    const inferredTypes = noEvidence ? [] : inferWizardEvidenceTypesFromProofNarrative(clean);
    return {
      extracted_response_updates: {
        strategic_base: {
          guided_intake_limitations_optional: lim,
        },
        evidence_base: noEvidence
          ? evidenceBaseNoClearPatch()
          : {
              evidence_types: inferredTypes,
              evidence_details: {
                narrativa_usuario: clean.slice(0, 2000),
              },
            },
      },
      confidence_by_field: {
        "evidence_base.evidence_types": low,
      },
      needs_follow_up: false,
      follow_up_question: null,
      suggested_answer_chips: [],
      answer_status: "fallback_saved",
      target_response_paths: noEvidence
        ? ["evidence_base.evidence_types", "strategic_base.guided_intake_limitations_optional"]
        : [
            "evidence_base.evidence_details",
            "strategic_base.guided_intake_limitations_optional",
          ],
      internal_notes: `${baseNotes} mini_step=evidence`,
      interviewer_message: interviewer,
      public_copy_allowed: false,
      user_intent: "answer",
    };
  }

  /** challenge_type / complete should not reach here */
  const lim = mergeLim(prevLimitations, ["guided_intake:fallback_unknown_step"]);
  return {
    extracted_response_updates: {
      strategic_base: {
        guided_intake_limitations_optional: lim,
      },
    },
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "weak",
    target_response_paths: ["strategic_base.guided_intake_limitations_optional"],
    internal_notes: `${baseNotes} mini_step=${miniStep}`,
    interviewer_message: interviewer,
    public_copy_allowed: false,
    user_intent: "answer",
  };
}

export type ExtractionRecovery = "none" | "repair" | "fallback";

export async function resolveGuidedIntakeExtraction(params: {
  generate: (input: string) => Promise<GuidedIntakeExtractionJsonResult>;
  system: string;
  schemaHint: string;
  userPrompt: string;
  miniStep: GuidedMiniStepId;
  challengeType: string | null;
  userText: string;
  prevLimitations: string[];
}): Promise<{
  extraction: IntakeExtractionOutput;
  modelUsed: string;
  raw_json_text: string;
  recovery: ExtractionRecovery;
}> {
  const logCtx = {
    mini_step: params.miniStep,
    challenge_type: params.challengeType,
    user_answer_length: params.userText.length,
  };

  const tryParseDetailed = (
    raw: string,
    modelUsed: string,
    stage: string,
  ):
    | { ok: true; data: IntakeExtractionOutput }
    | { ok: false; errorSummary: string } => {
    let json: unknown;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      const msg = "JSON.parse: invalid JSON";
      logGuidedIntakeExtractionFailure({
        stage: `${stage}:json_parse`,
        ...logCtx,
        raw_model_output: raw,
        validation_error: msg,
        model_used: modelUsed,
      });
      return { ok: false, errorSummary: msg };
    }
    const parsed = parseIntakeExtractionOutput(json);
    if (!parsed.ok) {
      logGuidedIntakeExtractionFailure({
        stage: `${stage}:schema`,
        ...logCtx,
        raw_model_output: raw,
        validation_error: parsed.error,
        model_used: modelUsed,
      });
      return { ok: false, errorSummary: parsed.error };
    }
    return { ok: true, data: parsed.data };
  };

  let recovery: ExtractionRecovery = "none";
  let firstRaw = "";
  let modelUsed = "";

  try {
    const r1 = await params.generate(
      `${params.system}\n\n${params.schemaHint}\n\n${params.userPrompt}`,
    );
    firstRaw = r1.raw_json_text;
    modelUsed = r1.model_used;
    const res1 = tryParseDetailed(firstRaw, modelUsed, "first");
    if (res1.ok) {
      return {
        extraction: res1.data,
        modelUsed,
        raw_json_text: firstRaw,
        recovery: "none",
      };
    }

    const repairInput = buildRepairExtractionInput({
      system: params.system,
      schemaHint: params.schemaHint,
      originalUserPrompt: params.userPrompt,
      validationErrorSummary: res1.errorSummary,
      invalidRawJson: firstRaw,
    });

    let secondRaw = firstRaw;
    try {
      const r2 = await params.generate(repairInput);
      secondRaw = r2.raw_json_text;
      modelUsed = r2.model_used;
    } catch (e) {
      logGuidedIntakeExtractionFailure({
        stage: "repair:generate_threw",
        ...logCtx,
        raw_model_output: firstRaw,
        validation_error: e instanceof Error ? e.message : String(e),
        model_used: modelUsed,
      });
      recovery = "fallback";
      return {
        extraction: buildDeterministicFallbackExtraction(
          params.miniStep,
          params.userText,
          params.prevLimitations,
        ),
        modelUsed,
        raw_json_text: firstRaw,
        recovery,
      };
    }

    const res2 = tryParseDetailed(secondRaw, modelUsed, "repair");
    if (res2.ok) {
      return {
        extraction: res2.data,
        modelUsed,
        raw_json_text: secondRaw,
        recovery: "repair",
      };
    }

    recovery = "fallback";
    return {
      extraction: buildDeterministicFallbackExtraction(
        params.miniStep,
        params.userText,
        params.prevLimitations,
      ),
      modelUsed,
      raw_json_text: secondRaw,
      recovery,
    };
  } catch (e) {
    logGuidedIntakeExtractionFailure({
      stage: "first:generate_threw",
      ...logCtx,
      raw_model_output: firstRaw,
      validation_error: e instanceof Error ? e.message : String(e),
      model_used: modelUsed,
    });
    throw e;
  }
}
