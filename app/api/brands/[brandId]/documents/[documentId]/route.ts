import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonUnauthorized,
} from "@/lib/api/route-auth";

type Params = { params: Promise<{ brandId: string; documentId: string }> };

const BUCKET = "brand-documents";

export async function DELETE(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId, documentId } = await params;

  const { data: doc, error: fetchError } = await supabase
    .from("brand_documents")
    .select("id, brand_id, storage_path")
    .eq("id", documentId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([doc.storage_path]);

  if (removeError) {
    const ignorable =
      /not\s*found|no\s*such|does\s*not\s*exist|object\s*not\s*found|404/i.test(
        removeError.message,
      );
    if (!ignorable) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  const { error: delError } = await supabase
    .from("brand_documents")
    .delete()
    .eq("id", documentId)
    .eq("brand_id", brandId);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
