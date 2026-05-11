import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { prepareBrandDocumentUploadSchema } from "@/lib/schemas/brand-document";
import {
  normalizeClientMimeType,
  validatePdfUploadMetadata,
} from "@/lib/brands/validate-pdf-upload";
import type { BrandDocumentRow } from "@/types/database";

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

export async function POST(request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  const ok = await assertBrandOwned(supabase, user.id, brandId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonBadRequest("JSON inválido.", {
      code: "parse_json",
      stage: "prepare_upload",
    });
  }

  const parsed = prepareBrandDocumentUploadSchema.safeParse(json);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.message;
    return jsonBadRequest(first, {
      code: "validation_body",
      stage: "prepare_upload",
    });
  }

  const body = parsed.data;
  const meta = validatePdfUploadMetadata({
    file_name: body.file_name,
    file_size_bytes: body.file_size_bytes,
    file_type: body.file_type,
  });
  if (!meta.ok) {
    return jsonBadRequest(meta.message, {
      code: meta.code,
      stage: "validation",
      detail: meta.detail,
    });
  }

  const documentId = crypto.randomUUID();
  const storagePath = `${user.id}/${brandId}/${documentId}.pdf`;
  const storedMime = normalizeClientMimeType(body.file_type) || "application/pdf";

  const { data: docRow, error: insertError } = await supabase
    .from("brand_documents")
    .insert({
      id: documentId,
      brand_id: brandId,
      user_id: user.id,
      file_name: body.file_name,
      file_type: storedMime,
      document_type: body.document_type,
      storage_path: storagePath,
      file_size_bytes: body.file_size_bytes,
      processing_status: "pending",
    })
    .select(
      "id, brand_id, user_id, file_name, file_type, document_type, storage_path, file_size_bytes, processing_status, processing_error, created_at, updated_at",
    )
    .single();

  if (insertError || !docRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "No se pudo crear el registro del documento." },
      { status: 500 },
    );
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (signError || !signed) {
    const msg = signError?.message ?? "No se pudo generar URL de subida.";
    await supabase
      .from("brand_documents")
      .update({
        processing_status: "failed",
        processing_error: `prepare_signed_url: ${msg}`,
      })
      .eq("id", documentId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    document: docRow as BrandDocumentRow,
    storage_path: storagePath,
    signed_url: signed.signedUrl,
    token: signed.token,
    path: signed.path,
  });
}
