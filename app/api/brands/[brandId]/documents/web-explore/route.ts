import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import {
  exploreBrandWebsiteControlled,
  type BrandWebExploreChallengeSourceMetadata,
  type BrandWebExploreOutcome,
  type BrandWebExploreTechnicalSummary,
} from "@/lib/brands/explore-brand-website-text";
import {
  BRAND_WEB_EXPLORE_STORAGE_CONTENT_TYPE,
  humanizeBrandDocumentStorageError,
} from "@/lib/brands/brand-documents-storage";
import { assertPublicExplorableHttpUrl } from "@/lib/brands/normalize-website-url";
import { inferBrandContextFileKind, storageExtensionForKind } from "@/lib/brands/validate-brand-context-upload";
import { brandWebExploreRequestSchema } from "@/lib/schemas/brand-document";
import type { BrandDocumentListRow, BrandDocumentRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ brandId: string }> };

const BUCKET = "brand-documents";

async function assertBrandOwned(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>["supabase"],
  userId: string,
  brandId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

function buildWebsiteCrawlSourceMetadata(
  summary: BrandWebExploreTechnicalSummary,
  outcome: BrandWebExploreOutcome,
  userMessage: string,
) {
  return {
    website_crawl: {
      ...summary,
      explore_outcome: outcome,
      ui_message_used: userMessage,
    },
  };
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", { code: "parse_json", stage: "web_explore" });
  }

  const parsed = brandWebExploreRequestSchema.safeParse(json);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first, { code: "validation_body", stage: "web_explore" });
  }

  const { count: pendingCount, error: pendingErr } = await supabase
    .from("brand_source_facts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "pending_review");

  if (pendingErr) {
    return NextResponse.json({ error: pendingErr.message }, { status: 500 });
  }
  if ((pendingCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Hay hallazgos pendientes de revisión. Revísalos antes de agregar una nueva fuente.",
        code: "pending_review_blocking",
      },
      { status: 409 },
    );
  }

  let normalized: URL;
  try {
    normalized = assertPublicExplorableHttpUrl(parsed.data.entry_url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No pudimos leer esa dirección.";
    return jsonBadRequest(msg, { code: "invalid_url", stage: "web_explore" });
  }

  let explored: Awaited<ReturnType<typeof exploreBrandWebsiteControlled>>;
  try {
    explored = await exploreBrandWebsiteControlled(normalized.href);
  } catch {
    return NextResponse.json(
      {
        error:
          "No pudimos leer suficiente información del sitio. Prueba con otra URL del mismo dominio o sube un archivo con el contenido.",
        code: "web_explore_failed",
      },
      { status: 500 },
    );
  }

  const text = explored.text.trim();
  if (text.length === 0) {
    const meta: BrandWebExploreChallengeSourceMetadata | undefined = explored.challengeSourceMetadata;
    const isJsBlocked = explored.outcome === "js_blocked";
    return NextResponse.json(
      {
        error: explored.userMessage,
        code: isJsBlocked ? "web_explore_js_blocked" : "web_explore_empty",
        outcome: explored.outcome,
        ...(explored.userRecommendation ? { user_recommendation: explored.userRecommendation } : {}),
        ...(meta ? { source_metadata: meta } : {}),
      },
      { status: 422 },
    );
  }

  const documentId = crypto.randomUUID();
  const buffer = Buffer.from(text, "utf8");
  const host = normalized.hostname.replace(/[^a-zA-Z0-9.-]+/g, "_").slice(0, 120);
  const fileName = `Sitio web (${host}).txt`;
  const kind = inferBrandContextFileKind(fileName);
  if (!kind) {
    return NextResponse.json({ error: "Nombre de archivo interno inválido." }, { status: 500 });
  }
  const ext = storageExtensionForKind(kind);
  const storagePath = `${user.id}/${brandId}/${documentId}.${ext}`;

  const sourceMetadata = buildWebsiteCrawlSourceMetadata(
    explored.summary,
    explored.outcome,
    explored.userMessage,
  );

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: BRAND_WEB_EXPLORE_STORAGE_CONTENT_TYPE,
      upsert: false,
    });

  if (upErr) {
    const raw = upErr.message ?? "No se pudo guardar el texto explorado en almacenamiento.";
    return NextResponse.json(
      { error: humanizeBrandDocumentStorageError(raw), code: "web_explore_storage_upload" },
      { status: 500 },
    );
  }

  const { data: docRow, error: insertError } = await supabase
    .from("brand_documents")
    .insert({
      id: documentId,
      brand_id: brandId,
      user_id: user.id,
      file_name: fileName,
      file_type: BRAND_WEB_EXPLORE_STORAGE_CONTENT_TYPE,
      document_type: parsed.data.document_type,
      storage_path: storagePath,
      file_size_bytes: buffer.byteLength,
      processing_status: "uploaded",
      processing_error: null,
      source_kind: "website_crawl",
      web_entry_url: normalized.href,
      source_metadata: sourceMetadata,
    })
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, source_kind, web_entry_url, source_metadata, created_at, updated_at",
    )
    .single();

  if (insertError || !docRow) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: insertError?.message ?? "No se pudo crear el registro del documento." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    document: {
      ...(docRow as BrandDocumentRow),
      extraction_summary: null,
    } as BrandDocumentListRow,
    web_explore: {
      outcome: explored.outcome,
      user_message: explored.userMessage,
      ...(explored.userRecommendation ? { user_recommendation: explored.userRecommendation } : {}),
    },
  });
}
