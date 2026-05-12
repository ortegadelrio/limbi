import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  BRAND_SECTION_IMPROVE_PROMPT_VERSION,
  brandSectionImproveCreateSessionBodySchema,
  brandSectionImproveTurnOutputSchema,
  validateProposedChangeQuestionKeys,
} from "@/lib/schemas/brand-section-improvement";
import {
  buildBrandSectionImprovementContext,
  type BrandSectionImprovementContextBrand,
} from "@/lib/brands/build-brand-section-improvement-context";
import {
  buildBrandSectionImprovementSystemInstructions,
  buildBrandSectionImprovementUserPayload,
} from "@/lib/prompts/brand-section-improvement";
import { generateBrandSectionImproveTurnJson } from "@/lib/openai/brand-section-improvement";
import type { BrandImprovementSessionRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ brandId: string }> };

function jsonConflict(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 409 });
}

async function assertBrandForImprove(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<BrandSectionImprovementContextBrand | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, description, website_url, country_or_market, brand_status")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data as BrandSectionImprovementContextBrand | null;
}

async function countPendingReview(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  brandId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");
  if (error) return 0;
  return count ?? 0;
}

function sessionStatusFromAiOutput(
  parsed: import("@/lib/schemas/brand-section-improvement").BrandSectionImproveTurnOutputParsed,
): "open" | "draft_ready" | "failed" {
  if (parsed.conversation_state === "blocked") return "failed";
  if (
    parsed.conversation_state === "draft_ready" ||
    (parsed.conversation_state === "completed" && parsed.proposed_changes.length > 0)
  ) {
    return "draft_ready";
  }
  return "open";
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const brand = await assertBrandForImprove(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((await countPendingReview(supabase, brandId)) > 0) {
    return jsonConflict(
      "Hay hallazgos pendientes de revisión. Revísalos antes de iniciar una sesión de mejora.",
      "pending_review_blocking",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", { code: "invalid_json", stage: "improve" });
  }

  const parsedBody = brandSectionImproveCreateSessionBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonBadRequest(parsedBody.error.message, { code: "validation_error", stage: "improve" });
  }

  const section_key = parsedBody.data.section_key.trim();

  const built = await buildBrandSectionImprovementContext(supabase, brandId, section_key, brand);
  if (!built.ok) {
    if (built.code === "diagnosis_required") {
      return jsonConflict(built.message, "diagnosis_required");
    }
    const status =
      built.code === "invalid_section" || built.code === "offer_profile_required" ? 400 : 500;
    return NextResponse.json({ error: built.message, code: built.code }, { status });
  }

  const { data: evaluation } = await supabase
    .from("brand_evaluations")
    .select("id")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("status", "succeeded")
    .maybeSingle();

  const evaluationId = (evaluation as { id: string } | null)?.id ?? null;

  await supabase
    .from("brand_improvement_sessions")
    .update({ status: "abandoned", closed_reason: "superseded_by_new_session" })
    .eq("brand_id", brandId)
    .eq("section_key", section_key)
    .in("status", ["open", "draft_ready"]);

  const { data: sessionInsert, error: insErr } = await supabase
    .from("brand_improvement_sessions")
    .insert({
      brand_id: brandId,
      section_key,
      status: "open",
      brand_evaluation_id: evaluationId,
      max_user_turns: 8,
      user_turn_count: 0,
      draft_payload: {},
      prompt_version: BRAND_SECTION_IMPROVE_PROMPT_VERSION,
    })
    .select("*")
    .single();

  if (insErr || !sessionInsert) {
    return NextResponse.json(
      { error: insErr?.message ?? "No se pudo crear la sesión." },
      { status: 500 },
    );
  }

  const session = sessionInsert as BrandImprovementSessionRow;
  const sessionId = session.id;
  const allowedKeys = [...built.questionKeys];

  const systemText = buildBrandSectionImprovementSystemInstructions();
  const userText = buildBrandSectionImprovementUserPayload({
    turn: "opening",
    improvement_context: built.context,
    turns_remaining: session.max_user_turns,
    max_user_turns: session.max_user_turns,
  });
  const fullInput = `${systemText}\n\n---\n\n${userText}`;

  try {
    const { model_used, raw_json_text } = await generateBrandSectionImproveTurnJson({
      input: fullInput,
      allowedQuestionKeys: allowedKeys,
    });

    let json: unknown;
    try {
      json = JSON.parse(raw_json_text) as unknown;
    } catch {
      await supabase
        .from("brand_improvement_sessions")
        .update({
          status: "failed",
          error_message: "Salida IA no es JSON válido.",
        })
        .eq("id", sessionId);
      return NextResponse.json(
        { error: "La IA devolvió un formato inválido. Reintenta.", code: "ia_parse_error" },
        { status: 502 },
      );
    }

    const z = brandSectionImproveTurnOutputSchema.safeParse(json);
    if (!z.success) {
      await supabase
        .from("brand_improvement_sessions")
        .update({
          status: "failed",
          error_message: z.error.message,
        })
        .eq("id", sessionId);
      return NextResponse.json(
        { error: `Salida IA inválida: ${z.error.message}`, code: "ia_schema_error" },
        { status: 502 },
      );
    }

    const vk = validateProposedChangeQuestionKeys(z.data, built.questionKeys);
    if (!vk.ok) {
      await supabase
        .from("brand_improvement_sessions")
        .update({ status: "failed", error_message: vk.message })
        .eq("id", sessionId);
      return NextResponse.json({ error: vk.message, code: "ia_schema_error" }, { status: 502 });
    }

    const nextStatus = sessionStatusFromAiOutput(z.data);
    const draftPayload = z.data as unknown as Record<string, unknown>;

    await supabase.from("brand_improvement_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: z.data.assistant_message,
      structured_payload: draftPayload,
      metadata: { turn: "opening" },
    });

    const { data: updated, error: updErr } = await supabase
      .from("brand_improvement_sessions")
      .update({
        status: nextStatus,
        draft_payload: draftPayload,
        model_used,
        error_message: nextStatus === "failed" ? "Estado blocked en salida IA." : null,
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message ?? "Error al guardar sesión." }, { status: 500 });
    }

    const { data: messages } = await supabase
      .from("brand_improvement_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      session: updated,
      messages: messages ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el primer mensaje.";
    await supabase
      .from("brand_improvement_sessions")
      .update({ status: "failed", error_message: msg })
      .eq("id", sessionId);
    return NextResponse.json({ error: msg, code: "improve_session_failed" }, { status: 500 });
  }
}
