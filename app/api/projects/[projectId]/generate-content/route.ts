import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
  jsonNotFound,
} from "@/lib/api/route-auth";
import {
  buildContentGenerationInput,
  CONTENT_GENERATION_PROMPT_VERSION,
  CONTENT_GENERATION_USER_NOTE_MAX,
  CONTENT_TYPE_DEFAULT_QUANTITY,
  CONTENT_GENERATION_MAX_QUANTITY,
} from "@/lib/content/build-input";
import { fetchLatestFrameworkRevisionGuidanceForProject } from "@/lib/framework/revision-events";
import {
  validateContentGenerationJson,
  type ContentValidationFailure,
  type ValidateContentGenerationJsonResult,
} from "@/lib/content/validate-content-json";
import { buildContentGenerationPrompt } from "@/lib/prompts/content-generation";
import { generateContentGenerationJson } from "@/lib/openai/content-generation";

type Params = { params: Promise<{ projectId: string }> };

const NO_ACTIVE_MASTER = "Primero debes generar el Documento Maestro.";

const NO_APPROVED_FRAMEWORK =
  "Primero debes aprobar el Marco Estratégico antes de generar contenidos.";

/** Mensaje fijo para 422: validación de calidad tras dos intentos. */
const VALIDATION_FAILED_USER_GUIDANCE =
  "No se pudo generar esta versión porque la respuesta no pasó la validación de calidad. Intenta con una nota más específica o vuelve a generar.";

const BodySchema = z
  .object({
    content_type: z.enum([
      "short_pitch",
      "captions",
      "content_ideas",
      "graphic_phrases",
    ]),
    quantity: z
      .number()
      .int("quantity debe ser un entero.")
      .min(1, "quantity debe ser al menos 1.")
      .max(
        CONTENT_GENERATION_MAX_QUANTITY,
        `quantity no puede ser mayor que ${String(CONTENT_GENERATION_MAX_QUANTITY)}.`,
      )
      .optional(),
    user_note: z
      .string()
      .max(
        CONTENT_GENERATION_USER_NOTE_MAX,
        `user_note no puede superar ${String(CONTENT_GENERATION_USER_NOTE_MAX)} caracteres.`,
      )
      .optional(),
  })
  .strict();

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

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { projectId } = await params;

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

  const { content_type, quantity: quantityRaw, user_note: userNoteRaw } =
    parsed.data;
  const quantity =
    quantityRaw ?? CONTENT_TYPE_DEFAULT_QUANTITY[content_type];
  const userNoteTrimmed = userNoteRaw?.trim();
  const userNote =
    userNoteTrimmed && userNoteTrimmed.length > 0 ? userNoteTrimmed : null;

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
    return NextResponse.json({ error: NO_ACTIVE_MASTER }, { status: 400 });
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
      { error: NO_APPROVED_FRAMEWORK },
      { status: 400 },
    );
  }

  const editorialGuidanceRow =
    await fetchLatestFrameworkRevisionGuidanceForProject(supabase, projectId);
  const persistentEditorialGuidance = editorialGuidanceRow?.revision_note ?? null;

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

  const { structured, input_payload_summary } = buildContentGenerationInput({
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
    contentType: content_type,
    quantity,
    userNote,
    persistentEditorialGuidance,
  });

  if (
    structured.content_generation_context.generation_trace_source ===
    "responses_fallback"
  ) {
    console.info(
      "[limbi][generate-content] Strategic context used project_responses fallback",
      {
        project_id: projectId,
        responses_fallback_fields:
          structured.content_generation_context.responses_fallback_fields,
      },
    );
  }

  let lastFailure: ContentValidationFailure | undefined;
  let model_used = "";
  let attempts_used = 0;
  let validatedOutput: Record<string, unknown> | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts_used = attempt;
    const prompt = buildContentGenerationPrompt(
      structured,
      attempt === 2 ? lastFailure : undefined,
    );

    let raw_json_text: string;
    try {
      const gen = await generateContentGenerationJson(prompt);
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
      content_type,
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
        error: "No se pudo validar el contenido generado.",
        user_guidance: VALIDATION_FAILED_USER_GUIDANCE,
      },
      { status: 422 },
    );
  }

  const validation_feedback_used = attempts_used === 2;

  const requestPayload: Record<string, unknown> = {
    prompt_version: CONTENT_GENERATION_PROMPT_VERSION,
    model_used,
    content_type,
    quantity,
    user_note: userNote,
    master_document_id: activeMaster.id,
    master_document_version: activeMaster.version,
    visible_framework_id: approvedFramework.id,
    visible_framework_version: approvedFramework.version,
    persistent_editorial_guidance: persistentEditorialGuidance,
    persistent_editorial_guidance_char_count:
      persistentEditorialGuidance?.length ?? 0,
    input_payload_summary,
    attempts_used,
    validation_feedback_used,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("generated_contents")
    .insert({
      project_id: projectId,
      user_id: user.id,
      master_document_id: activeMaster.id,
      visible_framework_id: approvedFramework.id,
      content_type,
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
          "No se pudo guardar el contenido generado.",
      },
      { status: 500 },
    );
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: projectId,
    user_id: user.id,
    event_type: "content_generated",
    payload: {
      project_id: projectId,
      generated_content_id: inserted.id,
      content_type,
      master_document_id: activeMaster.id,
      master_document_version: activeMaster.version,
      visible_framework_id: approvedFramework.id,
      visible_framework_version: approvedFramework.version,
      model_used,
      prompt_version: CONTENT_GENERATION_PROMPT_VERSION,
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
