import { NextResponse } from "next/server";
import {
  getAuthenticatedSupabase,
  jsonBadRequest,
  jsonUnauthorized,
} from "@/lib/api/route-auth";
import { prepareBrainstormSessionContext } from "@/lib/brainstormer/create-brainstorm-session-context";

export const runtime = "nodejs";

const BLOCKED_START_ES =
  "No puedo iniciar Brainstormer todavía porque esta marca no tiene una Base de Marca activa y una Base Límbica activa listas. Primero consolida la marca.";

const ADVISORY_ES =
  "Puedes iniciar la sesión, pero hay información pendiente o señales de desactualización en la marca. Brainstormer usará la versión activa actual.";

type Params = { params: Promise<{ brandId: string }> };

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getAuthenticatedSupabase();
  if (!user) return jsonUnauthorized();

  const { brandId } = await params;
  if (!isUuid(brandId)) {
    return jsonBadRequest("brandId inválido.", { code: "invalid_brand_id", stage: "brainstormer" });
  }

  const prep = await prepareBrainstormSessionContext(supabase, {
    userId: user.id,
    brandId,
  });

  if (!prep.ok) {
    return NextResponse.json({ error: prep.message, code: prep.code }, { status: 404 });
  }

  return NextResponse.json({
    brand_id: brandId,
    brand_context_status: prep.brand_context_status,
    can_start: prep.can_start,
    advisory_notice: prep.brand_context_status === "advisory" ? ADVISORY_ES : null,
    blocked_message: !prep.can_start ? BLOCKED_START_ES : null,
    recommended_warning: prep.recommended_warning,
    default_session_title: prep.title,
  });
}
