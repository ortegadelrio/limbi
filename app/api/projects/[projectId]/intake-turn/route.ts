import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { applyOfferingPilotExtraction } from "@/lib/intake/apply-extraction";
import { parseIntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { isGuidedIntakePilotEnabled } from "@/lib/intake/guided-intake-flag";
import {
  appendTurn,
  buildOfferingPilotSystemPrompt,
  buildOfferingPilotUserPrompt,
  buildSyntheticExtractionForChip,
  initialTrace,
  LIMBIC_INTERVIEW_TRACE_KEY,
  readInterviewTrace,
  type LimbicInterviewTraceV1,
} from "@/lib/intake/orchestrator";
import { buildOfferingPilotSummary } from "@/lib/intake/offering-pilot-summary";
import type { PilotEscapeChipId } from "@/lib/intake/question-bank";
import { generateGuidedIntakeExtractionJson } from "@/lib/openai/guided-intake-extraction";
import { deepMergeResponses } from "@/lib/utils/deep-merge";
import { mergeCompletedStepsForWizardStepIndices } from "@/lib/wizard/visible-moments";

type Params = { params: Promise<{ projectId: string }> };

const bodySchema = z
  .object({
    text: z.string().max(12000).optional(),
    action: z.enum(["no_info", "improve_later", "continue_base"]).optional(),
  })
  .refine(
    (d) =>
      (typeof d.text === "string" && d.text.trim().length > 0) ||
      d.action !== undefined,
    { message: "Envía texto o una acción (chip)." },
  );

function readStrategicBase(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const sb = r.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return { ...(sb as Record<string, unknown>) };
  }
  return {};
}

function normalizeCompletedSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function POST(request: Request, { params }: Params) {
  if (!isGuidedIntakePilotEnabled()) {
    return NextResponse.json(
      { error: "Entrevista guiada desactivada." },
      { status: 404 },
    );
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, challenge_type")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: existing, error: fetchError } = await supabase
    .from("project_responses")
    .select("id, responses, completed_steps")
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const baseResponses: Record<string, unknown> =
    existing?.responses &&
    typeof existing.responses === "object" &&
    existing.responses !== null &&
    !Array.isArray(existing.responses)
      ? { ...(existing.responses as Record<string, unknown>) }
      : {};

  const trace: LimbicInterviewTraceV1 =
    readInterviewTrace(baseResponses) ?? initialTrace();

  if (trace.phase === "done") {
    return NextResponse.json(
      { error: "Este piloto de módulo ya está cerrado." },
      { status: 400 },
    );
  }

  const challengeType =
    typeof project.challenge_type === "string"
      ? project.challenge_type
      : null;
  const sbSnap = readStrategicBase(baseResponses);
  const offeringHint =
    typeof sbSnap.offering_type === "string" ? sbSnap.offering_type : null;

  let extraction;
  const userLine =
    parsedBody.data.action !== undefined
      ? `[Acción del usuario: ${parsedBody.data.action}]`
      : (parsedBody.data.text ?? "").trim();

  if (parsedBody.data.action !== undefined) {
    extraction = buildSyntheticExtractionForChip(
      parsedBody.data.action as PilotEscapeChipId,
    );
  } else {
    const system = buildOfferingPilotSystemPrompt({
      challengeType,
      offeringTypeHint: offeringHint,
    });
    const schemaHint = `Required JSON shape:
{
  "extracted_response_updates": { "strategic_base": { ...partial } },
  "confidence_by_field": { "strategic_base.simple_description": 0-1, ... },
  "needs_follow_up": boolean,
  "follow_up_question": string | null,
  "suggested_answer_chips": string[],
  "answer_status": "clear" | "weak" | "missing_choice" | "skipped",
  "target_response_paths": string[],
  "internal_notes": string,
  "public_copy_allowed": boolean
}`;

    const userPrompt = buildOfferingPilotUserPrompt({
      trace,
      userText: userLine,
      strategicBaseSnapshot: sbSnap,
    });

    let raw: string;
    try {
      const r = await generateGuidedIntakeExtractionJson(
        `${system}\n\n${schemaHint}\n\n${userPrompt}`,
      );
      raw = r.raw_json_text;
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "No se pudo contactar al modelo de entrevista.",
        },
        { status: 502 },
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json(
        { error: "El modelo no devolvió JSON válido." },
        { status: 422 },
      );
    }

    const parsedEx = parseIntakeExtractionOutput(json);
    if (!parsedEx.ok) {
      return NextResponse.json(
        { error: "Extracción inválida", detail: parsedEx.error },
        { status: 422 },
      );
    }
    extraction = parsedEx.data;

    if (extraction.needs_follow_up && trace.follow_up_used) {
      extraction = {
        ...extraction,
        needs_follow_up: false,
        follow_up_question: null,
      };
    }
  }

  const { mergedResponses: mergedWithoutTrace, completedStepIndicesToMerge } =
    applyOfferingPilotExtraction(baseResponses, extraction);

  let nextTrace: LimbicInterviewTraceV1;
  if (parsedBody.data.action !== undefined) {
    nextTrace = { ...trace, phase: "done" };
  } else if (
    trace.phase === "main" &&
    extraction.needs_follow_up &&
    !trace.follow_up_used
  ) {
    nextTrace = { ...trace, phase: "follow_up", follow_up_used: true };
  } else {
    nextTrace = { ...trace, phase: "done" };
  }

  nextTrace = appendTurn(nextTrace, "user", userLine.slice(0, 500));
  nextTrace = appendTurn(
    nextTrace,
    "assistant",
    extraction.internal_notes.slice(0, 500),
  );

  const mergedResponses = deepMergeResponses(mergedWithoutTrace, {
    [LIMBIC_INTERVIEW_TRACE_KEY]: nextTrace,
  });

  const prevCompleted = normalizeCompletedSteps(existing?.completed_steps);
  const nextCompleted = mergeCompletedStepsForWizardStepIndices(
    prevCompleted,
    completedStepIndicesToMerge,
    { returnTo: null },
  );

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from("project_responses")
      .insert({
        project_id: projectId,
        user_id: user.id,
        responses: mergedResponses,
        completed_steps: nextCompleted,
      })
      .select("id, responses, completed_steps")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const summary =
      nextTrace.phase === "done"
        ? buildOfferingPilotSummary(
            mergedResponses,
            extraction.confidence_by_field,
          )
        : null;

    return NextResponse.json({
      project_responses: inserted,
      extraction,
      trace: nextTrace,
      follow_up_question: extraction.needs_follow_up
        ? extraction.follow_up_question
        : null,
      suggested_chips: extraction.suggested_answer_chips,
      summary,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_responses")
    .update({
      responses: mergedResponses,
      completed_steps: nextCompleted,
    })
    .eq("id", existing.id)
    .select("id, responses, completed_steps")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const summary =
    nextTrace.phase === "done"
      ? buildOfferingPilotSummary(
          mergedResponses,
          extraction.confidence_by_field,
        )
      : null;

  return NextResponse.json({
    project_responses: updated,
    extraction,
    trace: nextTrace,
    follow_up_question: extraction.needs_follow_up
      ? extraction.follow_up_question
      : null,
    suggested_chips: extraction.suggested_answer_chips,
    summary,
  });
}
