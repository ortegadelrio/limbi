import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBrandKnowledgeUiModel } from "@/lib/brands/brand-bases-consolidated-ui";
import {
  BRAND_KNOWLEDGE_HUB_SECTIONS,
  type BrandKnowledgeHubSectionDef,
  type BrandKnowledgeHubSectionStatus,
} from "@/lib/brands/brand-knowledge-hub-sections";
import { isAfterConsolidationCreatedAt } from "@/lib/brands/brand-bases-staleness";
import type { BrandKnowledgeUpdateRow } from "@/types/database";

export type BrandKnowledgeHubSectionState = {
  def: BrandKnowledgeHubSectionDef;
  summary: string;
  status: BrandKnowledgeHubSectionStatus;
  pendingReviewCount: number;
  approvedPendingConsolidationCount: number;
};

export type BrandKnowledgeHubState = {
  brandName: string;
  hasActiveKnowledgeBase: boolean;
  hasActiveLimbicBase: boolean;
  activeKnowledgeCreatedAt: string | null;
  sections: BrandKnowledgeHubSectionState[];
  totalPendingReview: number;
  totalApprovedPendingConsolidation: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function sectionInterpretationSummary(
  payload: Record<string, unknown> | null,
  baseSectionKeys: string[],
): string | null {
  if (!payload) return null;
  const sections = payload.section_interpretations;
  if (!Array.isArray(sections)) return null;
  for (const key of baseSectionKeys) {
    for (const row of sections) {
      const r = asRecord(row);
      if (r?.section_key !== key) continue;
      const headline = typeof r.headline === "string" ? r.headline.trim() : "";
      const interpretation = typeof r.interpretation === "string" ? r.interpretation.trim() : "";
      const combined = [headline, interpretation].filter(Boolean).join(" — ");
      if (combined.length > 0) return combined;
    }
  }
  return null;
}

function limbicSummary(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const parts: string[] = [];
  const symbolic = typeof payload.symbolic_reading === "string" ? payload.symbolic_reading.trim() : "";
  const atmosphere =
    typeof payload.atmosphere_and_metaphor === "string"
      ? payload.atmosphere_and_metaphor.trim()
      : "";
  if (symbolic) parts.push(symbolic);
  if (atmosphere) parts.push(atmosphere);
  return parts.length > 0 ? parts.join(" ") : null;
}

function credibilitySummary(
  knowledgePayload: Record<string, unknown> | null,
  knowledgeUi: ReturnType<typeof buildBrandKnowledgeUiModel>,
): string | null {
  const fromSection = sectionInterpretationSummary(knowledgePayload, ["evidence", "proof"]);
  if (fromSection) return fromSection;
  const cred = knowledgeUi.credibilityArchitecture;
  if (!cred) return null;
  const bits = [
    ...cred.reputation_proof_points.slice(0, 2),
    ...cred.authority_signals.slice(0, 1),
  ].filter(Boolean);
  if (bits.length > 0) return bits.join(" · ");
  return cred.communication_use_guidance || null;
}

function offerSummary(
  knowledgePayload: Record<string, unknown> | null,
  knowledgeUi: ReturnType<typeof buildBrandKnowledgeUiModel>,
): string | null {
  const fromSection = sectionInterpretationSummary(knowledgePayload, ["offer"]);
  if (fromSection) return fromSection;
  const offer = knowledgeUi.offerArchitecture;
  if (!offer?.offer_summary) return null;
  return offer.offer_summary;
}

function resolveSectionStatus(
  updates: BrandKnowledgeUpdateRow[],
  updateSectionKey: string,
  baseCreatedAt: string | null,
): {
  status: BrandKnowledgeHubSectionStatus;
  pendingReviewCount: number;
  approvedPendingConsolidationCount: number;
} {
  const inSection = updates.filter((u) => u.section_key === updateSectionKey);
  const pendingReviewCount = inSection.filter((u) => u.status === "pending_review").length;
  const approvedPendingConsolidationCount = inSection.filter((u) => {
    if (u.status !== "approved") return false;
    if (!baseCreatedAt) return true;
    return isAfterConsolidationCreatedAt(baseCreatedAt, u.approved_at ?? undefined);
  }).length;

  if (pendingReviewCount > 0) {
    return {
      status: "pending_review",
      pendingReviewCount,
      approvedPendingConsolidationCount,
    };
  }
  if (approvedPendingConsolidationCount > 0) {
    return {
      status: "pending_consolidation",
      pendingReviewCount,
      approvedPendingConsolidationCount,
    };
  }
  return {
    status: "updated",
    pendingReviewCount,
    approvedPendingConsolidationCount,
  };
}

function buildSummaryForSection(
  def: BrandKnowledgeHubSectionDef,
  knowledgePayload: Record<string, unknown> | null,
  limbicPayload: Record<string, unknown> | null,
  knowledgeUi: ReturnType<typeof buildBrandKnowledgeUiModel>,
  hasActiveKnowledgeBase: boolean,
  hasActiveLimbicBase: boolean,
): string {
  if (def.usesLimbicBase) {
    if (!hasActiveLimbicBase) {
      return "Aún no hay Base Límbica consolidada. Completá el cuestionario o consolidá la marca para ver el resumen simbólico.";
    }
    return (
      limbicSummary(limbicPayload) ??
      "Base Límbica activa sin lectura simbólica legible todavía."
    );
  }

  if (!hasActiveKnowledgeBase) {
    return "Sin Base de Marca consolidada en esta sección. Podés corregir el cuestionario o agregar novedades; Limbi las incorporará al consolidar.";
  }

  if (def.updateSectionKey === "offer") {
    return (
      offerSummary(knowledgePayload, knowledgeUi) ??
      "Oferta registrada en la base; revisá el cuestionario de inventario para el detalle operativo."
    );
  }

  if (def.updateSectionKey === "credibility") {
    return (
      credibilitySummary(knowledgePayload, knowledgeUi) ??
      "Credenciales en la base; agregá logros nuevos si hace falta ampliar el respaldo."
    );
  }

  if (def.updateSectionKey === "restrictions") {
    const alerts =
      typeof knowledgePayload?.restrictions_and_alerts === "string"
        ? knowledgePayload.restrictions_and_alerts.trim()
        : "";
    if (alerts) return alerts;
  }

  return (
    sectionInterpretationSummary(knowledgePayload, def.baseSectionKeys) ??
    "Información presente en la base consolidada; usá «Editar información actual» para ajustar el cuestionario."
  );
}

export async function fetchBrandKnowledgeHubState(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandKnowledgeHubState | null> {
  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();
  if (brandErr || !brand) return null;

  const [{ data: knowledge }, { data: limbic }, { data: updates }] = await Promise.all([
    supabase
      .from("brand_knowledge_bases")
      .select("consolidated_payload, created_at")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
    supabase
      .from("brand_limbic_bases")
      .select("consolidated_payload, created_at")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .is("superseded_at", null)
      .eq("status", "succeeded")
      .maybeSingle(),
    supabase
      .from("brand_knowledge_updates")
      .select(
        "id, section_key, status, approved_at, interpreted_summary, raw_text, created_at",
      )
      .eq("brand_id", brandId)
      .in("status", ["pending_review", "approved", "incorporated"]),
  ]);

  const knowledgePayload = asRecord(knowledge?.consolidated_payload);
  const limbicPayload = asRecord(limbic?.consolidated_payload);
  const knowledgeUi = buildBrandKnowledgeUiModel(knowledgePayload ?? {});
  const baseCreatedAt = knowledge?.created_at ?? null;
  const updateRows = (updates ?? []) as Pick<
    BrandKnowledgeUpdateRow,
    "id" | "section_key" | "status" | "approved_at" | "interpreted_summary" | "raw_text"
  >[];

  const fullUpdates = updateRows as BrandKnowledgeUpdateRow[];

  let totalPendingReview = 0;
  let totalApprovedPendingConsolidation = 0;

  const sections: BrandKnowledgeHubSectionState[] = BRAND_KNOWLEDGE_HUB_SECTIONS.map(
    (def) => {
      const { status, pendingReviewCount, approvedPendingConsolidationCount } =
        resolveSectionStatus(fullUpdates, def.updateSectionKey, baseCreatedAt);
      totalPendingReview += pendingReviewCount;
      totalApprovedPendingConsolidation += approvedPendingConsolidationCount;

      let summary = buildSummaryForSection(
        def,
        knowledgePayload,
        limbicPayload,
        knowledgeUi,
        Boolean(knowledge),
        Boolean(limbic),
      );

      const latestPending = fullUpdates.find(
        (u) =>
          u.section_key === def.updateSectionKey && u.status === "pending_review",
      );
      if (latestPending && status === "pending_review") {
        const snippet =
          latestPending.interpreted_summary?.trim() ||
          latestPending.raw_text.trim().slice(0, 200);
        summary = `${summary}\n\nNovedad pendiente de revisión: ${snippet}`;
      }

      return {
        def,
        summary,
        status,
        pendingReviewCount,
        approvedPendingConsolidationCount,
      };
    },
  );

  return {
    brandName: String(brand.name ?? "").trim() || "Marca",
    hasActiveKnowledgeBase: Boolean(knowledge),
    hasActiveLimbicBase: Boolean(limbic),
    activeKnowledgeCreatedAt: baseCreatedAt,
    sections,
    totalPendingReview,
    totalApprovedPendingConsolidation,
  };
}
