import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { attachExtractionSummaries } from "@/lib/brands/brand-document-extraction-summary";
import { extractPdfTextFromBuffer } from "@/lib/brands/extract-pdf-text";
import { BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS } from "@/lib/brands/validate-pdf-upload";
import type {
  BrandDocumentExtractionRow,
  BrandDocumentExtractionStatus,
  BrandDocumentRow,
} from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ brandId: string; documentId: string }> };

const BUCKET = "brand-documents";

const EMPTY_TEXT_USER_MESSAGE =
  "No se encontró texto seleccionable en este PDF. Puede ser un documento escaneado. El OCR quedará para una versión posterior.";

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

function isTerminalExtraction(status: BrandDocumentExtractionStatus | undefined) {
  return status === "succeeded" || status === "succeeded_empty";
}

export async function POST(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, documentId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("brand_documents")
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
    )
    .eq("id", documentId)
    .eq("brand_id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: extraction } = await supabase
    .from("brand_document_extractions")
    .select(
      "id, brand_document_id, brand_id, extraction_status, extracted_text, page_count, character_count, extraction_metadata, error_message, created_at, updated_at",
    )
    .eq("brand_document_id", documentId)
    .maybeSingle();

  const ex = extraction as BrandDocumentExtractionRow | null;

  if (doc.processing_status === "ready" && ex && isTerminalExtraction(ex.extraction_status)) {
    const merged = attachExtractionSummaries([doc as BrandDocumentRow], [
      {
        brand_document_id: ex.brand_document_id,
        extraction_status: ex.extraction_status,
        page_count: ex.page_count,
        character_count: ex.character_count,
        extraction_metadata: ex.extraction_metadata,
        error_message: ex.error_message,
      },
    ]);
    const listRow = merged[0];
    return NextResponse.json({
      document: listRow,
      extraction: {
        extraction_status: ex.extraction_status,
        page_count: ex.page_count,
        character_count: ex.character_count,
        truncated: Boolean((ex.extraction_metadata as Record<string, unknown>)?.truncated),
        message:
          ex.extraction_status === "succeeded_empty"
            ? EMPTY_TEXT_USER_MESSAGE
            : "Texto extraído correctamente.",
      },
    });
  }

  if (doc.processing_status === "processing" && ex?.extraction_status === "running") {
    return NextResponse.json(
      { error: "La extracción ya está en curso." },
      { status: 409 },
    );
  }

  if (doc.processing_status === "pending") {
    return jsonBadRequest(
      "El documento aún no está subido al almacenamiento; espera a que termine la subida.",
      { code: "document_not_uploaded", stage: "extract_text" },
    );
  }

  const { error: docProcErr } = await supabase
    .from("brand_documents")
    .update({ processing_status: "processing", processing_error: null })
    .eq("id", documentId);

  if (docProcErr) {
    return NextResponse.json({ error: docProcErr.message }, { status: 500 });
  }

  const { error: upsertExErr } = await supabase.from("brand_document_extractions").upsert(
    {
      brand_document_id: documentId,
      brand_id: brandId,
      extraction_status: "running",
      extracted_text: null,
      page_count: null,
      character_count: null,
      extraction_metadata: { engine: "pdf-parse", phase: "running" },
      error_message: null,
    },
    { onConflict: "brand_document_id" },
  );

  if (upsertExErr) {
    await supabase
      .from("brand_documents")
      .update({
        processing_status: "failed",
        processing_error: `No se pudo iniciar la extracción: ${upsertExErr.message}`,
      })
      .eq("id", documentId);
    return NextResponse.json({ error: upsertExErr.message }, { status: 500 });
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(doc.storage_path);

  if (dlErr || !blob) {
    const msg = dlErr?.message ?? "No se pudo descargar el PDF desde el almacenamiento.";
    await supabase
      .from("brand_document_extractions")
      .update({
        extraction_status: "failed",
        error_message: msg,
        extraction_metadata: { engine: "pdf-parse", phase: "download_failed" },
      })
      .eq("brand_document_id", documentId);
    await supabase
      .from("brand_documents")
      .update({ processing_status: "failed", processing_error: msg })
      .eq("id", documentId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await blob.arrayBuffer());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer el PDF descargado.";
    await supabase
      .from("brand_document_extractions")
      .update({
        extraction_status: "failed",
        error_message: msg,
        extraction_metadata: { engine: "pdf-parse", phase: "buffer_failed" },
      })
      .eq("brand_document_id", documentId);
    await supabase
      .from("brand_documents")
      .update({ processing_status: "failed", processing_error: msg })
      .eq("id", documentId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const parsed = await extractPdfTextFromBuffer(buffer);
    const trimmed = parsed.text.trim();

    if (trimmed.length === 0) {
      const meta: Record<string, unknown> = {
        engine: "pdf-parse",
        truncated: false,
      };
      await supabase
        .from("brand_document_extractions")
        .update({
          extraction_status: "succeeded_empty",
          extracted_text: null,
          page_count: parsed.pageCount,
          character_count: 0,
          extraction_metadata: meta,
          error_message: EMPTY_TEXT_USER_MESSAGE,
        })
        .eq("brand_document_id", documentId);
      await supabase
        .from("brand_documents")
        .update({ processing_status: "ready", processing_error: null })
        .eq("id", documentId);
    } else {
      const meta: Record<string, unknown> = {
        ...parsed.metadata,
        engine: "pdf-parse",
        truncated: parsed.truncated,
        ...(parsed.truncated
          ? { truncated_at_chars: BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS }
          : {}),
      };
      await supabase
        .from("brand_document_extractions")
        .update({
          extraction_status: "succeeded",
          extracted_text: parsed.text,
          page_count: parsed.pageCount,
          character_count: parsed.characterCount,
          extraction_metadata: meta,
          error_message: null,
        })
        .eq("brand_document_id", documentId);
      await supabase
        .from("brand_documents")
        .update({ processing_status: "ready", processing_error: null })
        .eq("id", documentId);
    }
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Error desconocido al procesar el PDF.";
    await supabase
      .from("brand_document_extractions")
      .update({
        extraction_status: "failed",
        error_message: msg,
        extraction_metadata: { engine: "pdf-parse", phase: "parse_failed" },
      })
      .eq("brand_document_id", documentId);
    await supabase
      .from("brand_documents")
      .update({
        processing_status: "failed",
        processing_error: `Error al extraer texto: ${msg}`,
      })
      .eq("id", documentId);
    return NextResponse.json({ error: `Error al extraer texto: ${msg}` }, { status: 500 });
  }

  const { data: finalDoc } = await supabase
    .from("brand_documents")
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
    )
    .eq("id", documentId)
    .single();

  const { data: finalEx } = await supabase
    .from("brand_document_extractions")
    .select(
      "id, brand_document_id, brand_id, extraction_status, extracted_text, page_count, character_count, extraction_metadata, error_message, created_at, updated_at",
    )
    .eq("brand_document_id", documentId)
    .single();

  const fx = finalEx as BrandDocumentExtractionRow | null;
  if (!finalDoc || !fx) {
    return NextResponse.json(
      { error: "Extracción completada pero no se pudo leer el resultado." },
      { status: 500 },
    );
  }

  const merged = attachExtractionSummaries([finalDoc as BrandDocumentRow], [
    {
      brand_document_id: fx.brand_document_id,
      extraction_status: fx.extraction_status,
      page_count: fx.page_count,
      character_count: fx.character_count,
      extraction_metadata: fx.extraction_metadata,
      error_message: fx.error_message,
    },
  ]);

  const truncated = Boolean((fx.extraction_metadata as Record<string, unknown>)?.truncated);

  return NextResponse.json({
    document: merged[0],
    extraction: {
      extraction_status: fx.extraction_status,
      page_count: fx.page_count,
      character_count: fx.character_count,
      truncated,
      message:
        fx.extraction_status === "succeeded_empty"
          ? EMPTY_TEXT_USER_MESSAGE
          : fx.extraction_status === "succeeded"
            ? truncated
              ? "Texto extraído y truncado para procesamiento."
              : "Texto extraído correctamente."
            : fx.extraction_status === "failed"
              ? fx.error_message ?? "Error al extraer texto."
              : "Extracción finalizada.",
    },
  });
}
