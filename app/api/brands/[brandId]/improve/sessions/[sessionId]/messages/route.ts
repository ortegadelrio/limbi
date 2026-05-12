import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  BRAND_SECTION_IMPROVE_PROMPT_VERSION,
  brandSectionImprovePostMessageBodySchema,
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

type Params = { params: Promise<{ brandId: string; sessionId: string }> };

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

  const { brandId, sessionId } = await params;
  const brand = await assertBrandForImprove(supabase, user.id, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((await countPendingReview(supabase, brandId)) > 0) {
    return jsonConflict(
      "Hay hallazgos pendientes de revisión. Revísalos antes de continuar.",
      "pending_review_blocking",
    );
  }

  const { data: sessionRow, error: sErr } = await supabase
    .from("brand_improvement_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  }

  const session = sessionRow as BrandImprovementSessionRow;
  if (session.status !== "open" && session.status !== "draft_ready") {
    return jsonConflict("Esta sesión ya no admite mensajes.", "session_not_active");
  }

  if (session.user_turn_count >= session.max_user_turns) {
    return jsonConflict(
      "Alcanzaste el máximo de turnos de usuario en esta sesión.",
      "max_turns_exceeded",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", { code: "invalid_json", stage: "improve" });
  }

  const parsedBody = brandSectionImprovePostMessageBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonBadRequest(parsedBody.error.message, { code: "validation_error", stage: "improve" });
  }

  const userContent = parsedBody.data.content.trim();

  const built = await buildBrandSectionImprovementContext(
    supabase,
    brandId,
    session.section_key,
    brand,
  );
  if (!built.ok) {
    return NextResponse.json({ error: built.message, code: built.code }, { status: 500 });
  }

  const { data: userIns, error: userInsErr } = await supabase
    .from("brand_improvement_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: userContent,
      metadata: {},
    })
    .select("id")
    .single();

  if (userInsErr || !userIns) {
    return NextResponse.json(
      { error: userInsErr?.message ?? "No se pudo guardar el mensaje." },
      { status: 500 },
    );
  }

  const userMessageId = (userIns as { id: string }).id;

  const { data: history } = await supabase
    .from("brand_improvement_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(40);

  const excerpt = (history ?? [])
    .map((m) => `${(m as { role: string }).role}: ${(m as { content: string }).content}`)
    .join("\n\n")
    .slice(-12000);

  const turnsRemainingAfter = session.max_user_turns - (session.user_turn_count + 1);

  const systemText = buildBrandSectionImprovementSystemInstructions();
  const userText = buildBrandSectionImprovementUserPayload({
    turn: "follow_up",
    improvement_context: built.context,
    turns_remaining: Math.max(0, turnsRemainingAfter),
    max_user_turns: session.max_user_turns,
    conversation_excerpt: excerpt,
  });
  const fullInput = `${systemText}\n\n---\n\n${userText}`;

  try {
    const { model_used, raw_json_text } = await generateBrandSectionImproveTurnJson({
      input: fullInput,
      allowedQuestionKeys: [...built.questionKeys],
    });

    const json = JSON.parse(raw_json_text) as unknown;
    const z = brandSectionImproveTurnOutputSchema.safeParse(json);
    if (!z.success) {
      await supabase.from("brand_improvement_messages").delete().eq("id", userMessageId);
      return NextResponse.json(
        { error: `Salida IA inválida: ${z.error.message}`, code: "ia_schema_error" },
        { status: 502 },
      );
    }

    const vk = validateProposedChangeQuestionKeys(z.data, built.questionKeys);
    if (!vk.ok) {
      await supabase.from("brand_improvement_messages").delete().eq("id", userMessageId);
      return NextResponse.json({ error: vk.message, code: "ia_schema_error" }, { status: 502 });
    }

    const nextStatus = sessionStatusFromAiOutput(z.data);
    const draftPayload = z.data as unknown as Record<string, unknown>;

    await supabase.from("brand_improvement_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: z.data.assistant_message,
      structured_payload: draftPayload,
      metadata: { turns_remaining_after: turnsRemainingAfter },
    });

    const { data: updated, error: updErr } = await supabase
      .from("brand_improvement_sessions")
      .update({
        user_turn_count: session.user_turn_count + 1,
        status: nextStatus,
        draft_payload: draftPayload,
        model_used,
        prompt_version: BRAND_SECTION_IMPROVE_PROMPT_VERSION,
        error_message: nextStatus === "failed" ? "Estado blocked en salida IA." : null,
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message ?? "Error al actualizar sesión." }, { status: 500 });
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
    await supabase.from("brand_improvement_messages").delete().eq("id", userMessageId);
    const msg = e instanceof Error ? e.message : "Error al procesar el mensaje.";
    return NextResponse.json({ error: msg, code: "improve_message_failed" }, { status: 500 });
  }
}
