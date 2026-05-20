import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveBrandContextForProject } from "@/lib/brands/load-active-brand-context-for-project";
import { loadFrozenBrandPayloadsForBrainstormSession } from "@/lib/brainstormer/load-frozen-brand-payloads-for-session";
import type { BrainstormSessionRow } from "@/types/database";

export type ResolvedBrainstormBrandContextForTurn = {
  knowledge_payload: Record<string, unknown> | null;
  limbic_payload: Record<string, unknown> | null;
  /** La base activa difiere de la congelada al crear la sesión. */
  brand_base_updated_since_session_freeze: boolean;
  active_knowledge_base_id: string | null;
  active_limbic_base_id: string | null;
};

export type ResolveBrainstormBrandContextForTurnError = {
  ok: false;
  code: string;
  message: string;
};

export type ResolveBrainstormBrandContextForTurnResult =
  | ResolvedBrainstormBrandContextForTurn
  | ResolveBrainstormBrandContextForTurnError;

export function isResolveBrainstormBrandContextError(
  r: ResolveBrainstormBrandContextForTurnResult,
): r is ResolveBrainstormBrandContextForTurnError {
  return "ok" in r && r.ok === false;
}

/**
 * Payloads para el turno: por defecto congelados; si la base activa cambió, usa la activa
 * para contextualizar respuestas futuras (ADN derivado de la nueva base).
 */
export async function resolveBrainstormBrandContextForTurn(
  supabase: SupabaseClient,
  session: Pick<
    BrainstormSessionRow,
    | "brand_id"
    | "brand_knowledge_base_id_used"
    | "brand_limbic_base_id_used"
  >,
  assertUserId: string,
): Promise<ResolveBrainstormBrandContextForTurnResult> {
  const frozen = await loadFrozenBrandPayloadsForBrainstormSession(
    supabase,
    session,
    assertUserId,
  );
  if (!frozen.ok) {
    return { ok: false, code: frozen.code, message: frozen.message };
  }

  const active = await loadActiveBrandContextForProject(supabase, session.brand_id, {
    assertUserId,
  });

  if (!active.ok) {
    return {
      knowledge_payload: frozen.knowledge_payload,
      limbic_payload: frozen.limbic_payload,
      brand_base_updated_since_session_freeze: false,
      active_knowledge_base_id: null,
      active_limbic_base_id: null,
    };
  }

  const activeKid = active.source_metadata.active_brand_knowledge_base_id;
  const activeLid = active.source_metadata.active_brand_limbic_base_id;
  const frozenKid = session.brand_knowledge_base_id_used;
  const frozenLid = session.brand_limbic_base_id_used;

  const drift =
    Boolean(activeKid && frozenKid && activeKid !== frozenKid) ||
    Boolean(activeLid && frozenLid && activeLid !== frozenLid);

  if (drift) {
    return {
      knowledge_payload: active.knowledge_payload,
      limbic_payload: active.limbic_payload,
      brand_base_updated_since_session_freeze: true,
      active_knowledge_base_id: activeKid,
      active_limbic_base_id: activeLid,
    };
  }

  return {
    knowledge_payload: frozen.knowledge_payload,
    limbic_payload: frozen.limbic_payload,
    brand_base_updated_since_session_freeze: false,
    active_knowledge_base_id: activeKid,
    active_limbic_base_id: activeLid,
  };
}
