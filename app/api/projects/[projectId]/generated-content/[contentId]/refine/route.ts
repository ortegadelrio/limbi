import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import { GLOBAL_AI_RULES } from "@/lib/ai/global-rules";
import {
  buildContentRefinementInputPayloadSummary,
  buildContentRefinementStructuredInput,
  CONTENT_REFINEMENT_CUSTOM_NOTE_MAX,
  CONTENT_REFINEMENT_PROMPT_VERSION,
  readItemsCountFromGeneratedOutput,
  readStoredStrategicFingerprint,
  type RefinementPreset,
} from "@/lib/content/refine-input";
import {
  validateContentGenerationJson,
  type ContentValidationFailure,
  type ValidateContentGenerationJsonResult,
} from "@/lib/content/validate-content-json";
import { fetchLatestFrameworkRevisionGuidanceForProject } from "@/lib/framework/revision-events";
import { generateContentRefinementJson } from "@/lib/openai/content-refinement";
import { buildContentRefinementPrompt } from "@/lib/prompts/content-refinement";
import type { ContentGenerationType } from "@/lib/content/build-input";

type Params = {
  params: Promise<{ projectId: string; contentId: string }>;
};

const REFINEMENT_PRESETS = [
  "more_direct",
  "more_emotional",
  "more_commercial",
  "more_provocative",
  "more_premium",
  "clearer",
  "less_institutional",
  "shorter",
  "more_punch",
  "more_human",
  "more_elegant",
] as const satisfies readonly RefinementPreset[];

const BodySchema = z
  .object({
    refinement_preset: z.enum(REFINEMENT_PRESETS).optional(),
    custom_refinement_note: z
      .string()
      .max(
        CONTENT_REFINEMENT_CUSTOM_NOTE_MAX,
        `custom_refinement_note no puede superar ${String(CONTENT_REFINEMENT_CUSTOM_NOTE_MAX)} caracteres.`,
      )
      .optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.refinement_preset !== undefined ||
      (b.custom_refinement_note !== undefined &&
        b.custom_refinement_note.trim().length > 0),
    {
      message:
        "Debes enviar refinement_preset y/o custom_refinement_note no vacío.",
    },
  );

const STRATEGY_MISMATCH_MESSAGE =
  "Este contenido fue generado con una versión anterior de la base estratégica. Genera un nuevo contenido desde el Marco aprobado actual antes de refinarlo.";

const VALIDATION_FAILED_USER_GUIDANCE =
  "No se pudo generar esta versión porque la respuesta no pasó la validación de calidad. Intenta con una nota más específica o vuelve a generar.";

function failureFromValidation(
  v: Extract<ValidateContentGenerationJsonResult, { ok: false }>,
): ContentValidationFailure {
  return {
    message: v.message,
    internal_reason: v.internal_reason,
    offending_rule: v.offending_rule,
    ...(v.offending_value !== undefined
      ? { offending_value: v.offending_value }
      : {}),
  };
}

function isContentGenerationType(v: string): v is ContentGenerationType {
  return (
    v === "short_pitch" ||
    v === "captions" ||
    v === "content_ideas" ||
    v === "graphic_phrases"
  );
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId, contentId } = await params;

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido o vacío." },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(jsonBody);
  if (!parsed.success) {
    const first = parsed.error.flatten().formErrors[0] ?? parsed.error.message;
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const refinementPreset = parsed.data.refinement_preset ?? null;
  const customRaw = parsed.data.custom_refinement_note?.trim();
  const customRefinementNote =
    customRaw && customRaw.length > 0 ? customRaw : null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, user_id, name_or_descriptor, name_status, challenge_type, main_challenge, status, created_at, updated_at",
    )
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return jsonNotFound();
  }

  const { data: sourceRow, error: sourceError } = await supabase
    .from("generated_contents")
    .select(
      "id, project_id, user_id, content_type, status, request, output, master_document_id, visible_framework_id",
    )
    .eq("id", contentId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }
  if (!sourceRow) {
    return jsonNotFound();
  }

  if (sourceRow.user_id !== user.id) {
    return jsonNotFound();
  }

  const contentTypeRaw = sourceRow.content_type;
  if (typeof contentTypeRaw !== "string" || !isContentGenerationType(contentTypeRaw)) {
    return NextResponse.json(
      { error: "Tipo de contenido no soportado para refinamiento." },
      { status: 400 },
    );
  }
  const contentType = contentTypeRaw;

  const sourceRequest =
    sourceRow.request &&
    typeof sourceRow.request === "object" &&
    !Array.isArray(sourceRow.request)
      ? (sourceRow.request as Record<string, unknown>)
      : {};

  const sourceOutput =
    sourceRow.output &&
    typeof sourceRow.output === "object" &&
    !Array.isArray(sourceRow.output)
      ? (sourceRow.output as Record<string, unknown>)
      : {};

  const quantity = readItemsCountFromGeneratedOutput(sourceOutput);
  if (quantity < 1) {
    return NextResponse.json(
      { error: "El contenido fuente no tiene ítems válidos para refinar." },
      { status: 400 },
    );
  }

  const { data: activeMaster, error: masterError } = await supabase
    .from("master_documents")
    .select("id, version, document, status")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (masterError) {
    return NextResponse.json({ error: masterError.message }, { status: 500 });
  }
  if (!activeMaster) {
    return NextResponse.json(
      { error: "No hay Documento Maestro activo." },
      { status: 400 },
    );
  }

  const { data: approvedFramework, error: fwError } = await supabase
    .from("visible_frameworks")
    .select("id, version, framework, status")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fwError) {
    return NextResponse.json({ error: fwError.message }, { status: 500 });
  }
  if (!approvedFramework) {
    return NextResponse.json(
      { error: "No hay Marco Estratégico aprobado." },
      { status: 400 },
    );
  }

  const fingerprint = readStoredStrategicFingerprint(
    {
      master_document_id: sourceRow.master_document_id,
      visible_framework_id: sourceRow.visible_framework_id,
    },
    sourceRequest,
  );

  if (
    !fingerprint ||
    fingerprint.master_document_id !== activeMaster.id ||
    fingerprint.master_document_version !== activeMaster.version ||
    fingerprint.visible_framework_id !== approvedFramework.id ||
    fingerprint.visible_framework_version !== approvedFramework.version
  ) {
    return NextResponse.json({ error: STRATEGY_MISMATCH_MESSAGE }, { status: 409 });
  }

  const document: Record<string, unknown> =
    activeMaster.document &&
    typeof activeMaster.document === "object" &&
    !Array.isArray(activeMaster.document)
      ? (activeMaster.document as Record<string, unknown>)
      : {};

  const framework: Record<string, unknown> =
    approvedFramework.framework &&
    typeof approvedFramework.framework === "object" &&
    !Array.isArray(approvedFramework.framework)
      ? (approvedFramework.framework as Record<string, unknown>)
      : {};

  const editorialGuidanceRow =
    await fetchLatestFrameworkRevisionGuidanceForProject(supabase, projectId);
  const persistentEditorialGuidance =
    editorialGuidanceRow?.revision_note ?? null;

  const { data: pr, error: prError } = await supabase
    .from("project_responses")
    .select("responses")
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

  const structured = buildContentRefinementStructuredInput({
    project,
    responses,
    masterDocument: {
      id: activeMaster.id,
      version: activeMaster.version,
      document,
    },
    visibleFramework: {
      id: approvedFramework.id,
      version: approvedFramework.version,
      framework,
    },
    contentType,
    quantity,
    userNote: null,
    persistentEditorialGuidance,
    sourceGeneratedContentId: contentId,
    sourceRequest,
    sourceOutput,
    refinementPreset,
    customRefinementNote,
  });

  let lastFailure: ContentValidationFailure | undefined;
  let model_used = "";
  let attempts_used = 0;
  let validatedOutput: Record<string, unknown> | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts_used = attempt;
    const prompt = buildContentRefinementPrompt({
      global_ai_rules: GLOBAL_AI_RULES,
      structured,
      sourceGeneratedContentId: contentId,
      sourceRequest,
      sourceOutput,
      refinementPreset,
      customRefinementNote,
      validationFeedback: attempt === 2 ? lastFailure : undefined,
    });

    let raw_json_text: string;
    try {
      const gen = await generateContentRefinementJson(prompt);
      model_used = gen.model_used;
      raw_json_text = gen.raw_json_text;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Error al llamar a OpenAI.";
      const status =
        msg.includes("OPENAI_API_KEY") || msg.includes("no está configurada")
          ? 503
          : 502;
      return NextResponse.json({ error: msg }, { status });
    }

    const validated = validateContentGenerationJson(
      raw_json_text,
      contentType,
      quantity,
      persistentEditorialGuidance,
    );

    if (validated.ok) {
      validatedOutput = validated.output;
      break;
    }

    lastFailure = failureFromValidation(validated);

    if (attempt === 2) {
      return NextResponse.json(
        {
          error: `${lastFailure.message} Tras un segundo intento automático, la respuesta sigue sin pasar la validación de calidad.`,
          user_guidance: VALIDATION_FAILED_USER_GUIDANCE,
          validation_failure: {
            message: lastFailure.message,
            offending_rule: lastFailure.offending_rule,
            internal_reason: lastFailure.internal_reason,
            ...(lastFailure.offending_value !== undefined
              ? { offending_value: lastFailure.offending_value }
              : {}),
          },
        },
        { status: 422 },
      );
    }
  }

  if (!validatedOutput) {
    return NextResponse.json(
      {
        error: "No se pudo validar el contenido refinado.",
        user_guidance: VALIDATION_FAILED_USER_GUIDANCE,
      },
      { status: 422 },
    );
  }

  const validation_feedback_used = attempts_used === 2;

  const input_payload_summary = buildContentRefinementInputPayloadSummary({
    hasSourceOutput: true,
    hasPersistentEditorialGuidance: persistentEditorialGuidance !== null,
    hasApprovedFrameworkSnapshot: Object.keys(framework).length > 0,
  });

  const requestPayload: Record<string, unknown> = {
    prompt_version: CONTENT_REFINEMENT_PROMPT_VERSION,
    model_used,
    source_generated_content_id: contentId,
    source_content_type: contentType,
    refinement_preset: refinementPreset ?? "",
    custom_refinement_note: customRefinementNote ?? "",
    attempts_used,
    validation_feedback_used,
    master_document_id: activeMaster.id,
    master_document_version: activeMaster.version,
    visible_framework_id: approvedFramework.id,
    visible_framework_version: approvedFramework.version,
    persistent_editorial_guidance: persistentEditorialGuidance,
    persistent_editorial_guidance_char_count:
      persistentEditorialGuidance?.length ?? 0,
    input_payload_summary,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("generated_contents")
    .insert({
      project_id: projectId,
      user_id: user.id,
      master_document_id: activeMaster.id,
      visible_framework_id: approvedFramework.id,
      content_type: contentType,
      request: requestPayload,
      output: validatedOutput,
      status: "generated",
    })
    .select("id, project_id, content_type, status, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      {
        error:
          insertError?.message ??
          "No se pudo guardar el contenido refinado.",
      },
      { status: 500 },
    );
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: projectId,
    user_id: user.id,
    event_type: "content_refined",
    payload: {
      project_id: projectId,
      source_generated_content_id: contentId,
      new_generated_content_id: inserted.id,
      content_type: contentType,
      refinement_preset: refinementPreset ?? "",
      custom_refinement_note: customRefinementNote ?? "",
      master_document_id: activeMaster.id,
      visible_framework_id: approvedFramework.id,
      created_at: inserted.created_at,
    },
  });

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      generated_content: {
        id: inserted.id,
        project_id: inserted.project_id,
        content_type: inserted.content_type,
        status: inserted.status,
        created_at: inserted.created_at,
      },
    },
    { status: 201 },
  );
}
