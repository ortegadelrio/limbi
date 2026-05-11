import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { completeBrandDocumentUploadSchema } from "@/lib/schemas/brand-document";
import type { BrandDocumentListRow, BrandDocumentRow } from "@/types/database";

type Params = { params: Promise<{ brandId: string; documentId: string }> };

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

function objectNameFromStoragePath(storagePath: string): {
  folder: string;
  fileName: string;
} {
  const parts = storagePath.split("/").filter(Boolean);
  const fileName = parts.pop() ?? "";
  const folder = parts.join("/");
  return { folder, fileName };
}

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, documentId } = await params;
  const owned = await assertBrandOwned(supabase, user.id, brandId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: doc, error: fetchError } = await supabase
    .from("brand_documents")
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
    )
    .eq("id", documentId)
    .eq("brand_id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonBadRequest("JSON inválido.", {
        code: "parse_json",
        stage: "complete_upload",
      });
    }
  }

  const parsed = completeBrandDocumentUploadSchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first, {
      code: "validation_body",
      stage: "complete_upload",
    });
  }

  if (parsed.data.status === "failed") {
    const { data: updated, error: upErr } = await supabase
      .from("brand_documents")
      .update({
        processing_status: "failed",
        processing_error: parsed.data.error!.trim().slice(0, 4000),
      })
      .eq("id", documentId)
      .select(
        "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
      )
      .single();
    if (upErr || !updated) {
      return NextResponse.json(
        { error: upErr?.message ?? "No se pudo actualizar el documento." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      document: {
        ...(updated as BrandDocumentRow),
        extraction_summary: null,
      } as BrandDocumentListRow,
    });
  }

  const { folder, fileName } = objectNameFromStoragePath(doc.storage_path);
  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 1000 });

  if (listError) {
    return NextResponse.json(
      {
        error: `No se pudo comprobar el archivo en almacenamiento: ${listError.message}`,
      },
      { status: 500 },
    );
  }

  const exists =
    listed?.some((item) => item.name === fileName && item.id !== null) ?? false;

  if (!exists) {
    const { data: failedRow, error: failErr } = await supabase
      .from("brand_documents")
      .update({
        processing_status: "failed",
        processing_error:
          "No se encontró el archivo en el almacenamiento tras la subida (¿subida incompleta o cancelada?).",
      })
      .eq("id", documentId)
      .select(
        "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
      )
      .single();
    if (failErr || !failedRow) {
      return NextResponse.json(
        { error: failErr?.message ?? "No se pudo marcar el documento como fallido." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        error:
          "No se encontró el archivo en el almacenamiento. Revisa la conexión o vuelve a subir.",
        document: {
          ...(failedRow as BrandDocumentRow),
          extraction_summary: null,
        } as BrandDocumentListRow,
      },
      { status: 422 },
    );
  }

  const { data: finalRow, error: finalError } = await supabase
    .from("brand_documents")
    .update({ processing_status: "uploaded", processing_error: null })
    .eq("id", documentId)
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
    )
    .single();

  if (finalError || !finalRow) {
    return NextResponse.json(
      {
        error:
          finalError?.message ??
          "El archivo está en almacenamiento pero no se pudo marcar como subido.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    document: {
      ...(finalRow as BrandDocumentRow),
      extraction_summary: null,
    } as BrandDocumentListRow,
  });
}
