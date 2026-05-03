import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { buildMasterDocumentInput } from "@/lib/master-document/build-input";
import { buildPostQuestionnaireStrategicRefinements } from "@/lib/master-document/post-questionnaire-refinements";
import { computeClarificationsPayloadHash } from "@/lib/questionnaire-evaluation/clarifications-hash";
import { resolvePostQuestionnaireRefinementBundle } from "@/lib/questionnaire-evaluation/resolve-refinements-for-master";
import {
  getActiveQuestionnaireEvaluation,
  getLatestQuestionnaireClarifications,
  linkLatestPendingClarificationToMasterDocument,
} from "@/lib/questionnaire-evaluation/supabase-questionnaire";
import { computeSourceResponsesHash } from "@/lib/master-document/source-responses-hash";
import { normalizeMasterDocumentBeforeValidation } from "@/lib/master-document/normalize-master-document";
import {
  MASTER_DOCUMENT_VALIDATION_USER_ERROR_ES,
  getMasterDocumentValidationFailureKind,
  parseMasterDocumentJson,
  validateMasterDocumentRecord,
} from "@/lib/master-document/validate-openai-json";
import {
  buildMasterDocumentPrompt,
  buildMasterDocumentValidationRetrySupplement,
} from "@/lib/prompts/master-document";
import { generateMasterDocumentJson } from "@/lib/openai/master-document";

type Params = { params: Promise<{ projectId: string }> };

type ProcessMasterJsonResult =
  | {
      ok: true;
      document: Record<string, unknown>;
      limbic_literal_limits_applied: boolean;
    }
  | {
      ok: false;
      message: string;
      limbic_literal_limits_applied: boolean;
    };

/** Parse → normalización segura del sistema → validación estricta. */
function processMasterModelJson(raw_json_text: string): ProcessMasterJsonResult {
  const parsed = parseMasterDocumentJson(raw_json_text);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
      limbic_literal_limits_applied: false,
    };
  }
  const { limbic_literal_limits_applied } =
    normalizeMasterDocumentBeforeValidation(parsed.document);
  const validated = validateMasterDocumentRecord(parsed.document);
  if (!validated.ok) {
    return {
      ok: false,
      message: validated.message,
      limbic_literal_limits_applied,
    };
  }
  return {
    ok: true,
    document: validated.document,
    limbic_literal_limits_applied,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function completedStepsCount(completed_steps: unknown): number {
  return Array.isArray(completed_steps) ? completed_steps.length : 0;
}

export async function POST(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select(
      "responses, completed_steps, questionnaire_pre_master_evaluation, questionnaire_pre_master_evaluation_source_hash, questionnaire_clarifications",
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (prError) {
    return NextResponse.json({ error: prError.message }, { status: 500 });
  }

  const responses: Record<string, unknown> =
    pr?.responses &&
    typeof pr.responses === "object" &&
    pr.responses !== null &&
    !Array.isArray(pr.responses)
      ? (pr.responses as Record<string, unknown>)
      : {};

  const sourceHash = computeSourceResponsesHash(responses);
  const activeEvalRow = await getActiveQuestionnaireEvaluation(
    supabase,
    projectId,
    { sourceResponsesHash: sourceHash },
  );
  const latestClarRow = activeEvalRow
    ? await getLatestQuestionnaireClarifications(
        supabase,
        projectId,
        activeEvalRow.id,
      )
    : null;

  const legacySourceHash =
    typeof pr?.questionnaire_pre_master_evaluation_source_hash === "string"
      ? pr.questionnaire_pre_master_evaluation_source_hash
      : null;

  const refinementBundle = resolvePostQuestionnaireRefinementBundle({
    currentResponsesHash: sourceHash,
    newTableEvaluation: activeEvalRow,
    newTableClarification: latestClarRow,
    legacyEvaluation: pr?.questionnaire_pre_master_evaluation ?? null,
    legacyClarifications: pr?.questionnaire_clarifications ?? null,
    legacySourceHash,
  });

  const clarificationsForMaster = (() => {
    const jsonb = pr?.questionnaire_clarifications;
    const slim = refinementBundle.clarifications;
    if (jsonb && typeof jsonb === "object" && !Array.isArray(jsonb)) {
      const j = jsonb as Record<string, unknown>;
      if (slim && typeof slim === "object" && !Array.isArray(slim)) {
        const s = slim as Record<string, unknown>;
        return {
          ...j,
          ...s,
          answers: Array.isArray(s.answers) ? s.answers : j.answers,
          submitted_at:
            typeof s.submitted_at === "string" ? s.submitted_at : j.submitted_at,
        };
      }
      return jsonb;
    }
    return slim;
  })();

  const post_questionnaire_strategic_refinements =
    buildPostQuestionnaireStrategicRefinements(
      refinementBundle.evaluation,
      clarificationsForMaster,
      responses,
    );

  const structured = buildMasterDocumentInput({
    project,
    responses,
    post_questionnaire_strategic_refinements,
  });
  const prompt = buildMasterDocumentPrompt(structured);

  let model_used: string;
  let raw_json_text: string;
  try {
    const gen = await generateMasterDocumentJson(prompt);
    model_used = gen.model_used;
    raw_json_text = gen.raw_json_text;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al llamar a OpenAI.";
    const status =
      msg.includes("OPENAI_API_KEY") || msg.includes("no está configurada")
        ? 503
        : 502;
    return NextResponse.json(
      { error: msg },
      { status },
    );
  }

  let attempts_used = 1;
  let processed = processMasterModelJson(raw_json_text);

  if (!processed.ok) {
    console.error(
      "[generate-master] validation failed",
      JSON.stringify({
        attempt: 1,
        validation_error: processed.message,
        normalization_applied: processed.limbic_literal_limits_applied,
        failure_kind: getMasterDocumentValidationFailureKind(processed.message),
      }),
    );
    try {
      const retryPrompt = `${prompt}\n\n${buildMasterDocumentValidationRetrySupplement(processed.message)}`;
      attempts_used = 2;
      const gen2 = await generateMasterDocumentJson(retryPrompt);
      model_used = gen2.model_used;
      raw_json_text = gen2.raw_json_text;
      processed = processMasterModelJson(raw_json_text);
      if (!processed.ok) {
        console.error(
          "[generate-master] validation failed",
          JSON.stringify({
            attempt: 2,
            validation_error: processed.message,
            normalization_applied: processed.limbic_literal_limits_applied,
            failure_kind: getMasterDocumentValidationFailureKind(
              processed.message,
            ),
          }),
        );
      }
    } catch (e) {
      const technical =
        e instanceof Error
          ? `${e.message}${e.stack ? `\n${e.stack}` : ""}`
          : String(e);
      console.error("[generate-master] retry OpenAI call failed:", technical);
      const body: Record<string, unknown> = {
        error: MASTER_DOCUMENT_VALIDATION_USER_ERROR_ES,
      };
      if (process.env.NODE_ENV === "development") {
        body.debug_validation_error = technical;
        body.attempts_used = attempts_used;
      }
      return NextResponse.json(body, { status: 422 });
    }
  }

  if (!processed.ok) {
    const body: Record<string, unknown> = {
      error: MASTER_DOCUMENT_VALIDATION_USER_ERROR_ES,
    };
    if (process.env.NODE_ENV === "development") {
      body.debug_validation_error = processed.message;
      body.attempts_used = attempts_used;
    }
    return NextResponse.json(body, { status: 422 });
  }

  const source_responses_hash = sourceHash;
  const source_clarifications_hash = post_questionnaire_strategic_refinements
    ? computeClarificationsPayloadHash(
        post_questionnaire_strategic_refinements as Record<string, unknown>,
      )
    : undefined;

  const documentToPersist: Record<string, unknown> = {
    ...processed.document,
    system_metadata: {
      source_responses_hash,
      ...(source_clarifications_hash
        ? {
            source_clarifications_hash,
            had_post_questionnaire_clarifications: true,
          }
        : {}),
    },
  };

  const { data: maxRow, error: maxError } = await supabase
    .from("master_documents")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    return NextResponse.json({ error: maxError.message }, { status: 500 });
  }

  const nextVersion =
    typeof maxRow?.version === "number" ? maxRow.version + 1 : 1;

  const { data: inserted, error: insertError } = await supabase
    .from("master_documents")
    .insert({
      project_id: projectId,
      user_id: user.id,
      version: nextVersion,
      document: documentToPersist,
      status: "active",
    })
    .select("id, project_id, version, status, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "No se pudo guardar el documento maestro." },
      { status: 500 },
    );
  }

  const { error: archiveError } = await supabase
    .from("master_documents")
    .update({ status: "archived" })
    .eq("project_id", projectId)
    .eq("status", "active")
    .neq("id", inserted.id);

  if (archiveError) {
    return NextResponse.json(
      { error: archiveError.message },
      { status: 500 },
    );
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ status: "master_created" })
    .eq("id", projectId);

  if (projectUpdateError) {
    return NextResponse.json(
      { error: projectUpdateError.message },
      { status: 500 },
    );
  }

  const limbic = responses.limbic_base;
  const evidence = responses.evidence_base;
  const has_limbic_interpretation =
    isPlainObject(limbic) && Object.keys(limbic).length > 0;
  const has_evidence_base =
    isPlainObject(evidence) && Object.keys(evidence).length > 0;

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: projectId,
    user_id: user.id,
    event_type: "master_document_created",
    payload: {
      master_document_id: inserted.id,
      version: inserted.version,
      prompt_version: structured.generation_instructions.builder_version,
      builder_version: structured.generation_instructions.builder_version,
      model_used,
      project_id: projectId,
      completed_steps_count: completedStepsCount(pr?.completed_steps),
      has_limbic_interpretation,
      has_evidence_base,
    },
  });

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  if (refinementBundle.linkTarget) {
    const { error: linkErr } =
      await linkLatestPendingClarificationToMasterDocument(
        supabase,
        projectId,
        refinementBundle.linkTarget.evaluationId,
        inserted.id,
      );
    if (linkErr) {
      console.error(
        "[generate-master] linkLatestPendingClarificationToMasterDocument",
        linkErr.message,
      );
    }
  }

  return NextResponse.json({
    master_document: {
      id: inserted.id,
      project_id: inserted.project_id,
      version: inserted.version,
      status: inserted.status,
      created_at: inserted.created_at,
    },
  });
}
