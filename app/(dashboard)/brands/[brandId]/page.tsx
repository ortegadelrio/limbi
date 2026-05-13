import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
} from "@/components/projects/limbi-ui";
import { fetchBrandDashboardDiagnosisState } from "@/lib/brands/fetch-brand-dashboard-diagnosis-state";
import { fetchBrandDashboardBasesState } from "@/lib/brands/fetch-brand-dashboard-bases-state";
import { BrandDashboardMaintenanceClient } from "@/components/brands/brand-dashboard-maintenance-client";
import {
  buildBrandDashboardMaintenanceSecondaryLinks,
  resolveBrandDashboardMaintenance,
} from "@/lib/brands/brand-dashboard-maintenance-action";
import { formatBogotaDateTime } from "@/lib/datetime/format-bogota-date-time";
import { cn } from "@/lib/utils";
import { offerNatureLabelEs } from "@/lib/brands/offer-nature-labels";
import { BRAND_STATUS_OPTIONS } from "@/lib/brands/brand-status-labels";

type Props = { params: Promise<{ brandId: string }> };

function brandStatusLabel(code: string): string {
  return BRAND_STATUS_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export default async function BrandDetailPage({ params }: Props) {
  const { brandId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, name, description, brand_status, website_url, country_or_market, updated_at",
    )
    .eq("id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (brandError) {
    throw new Error(brandError.message);
  }
  if (!brand) notFound();

  const { data: profile } = await supabase
    .from("brand_offer_profiles")
    .select("offer_nature")
    .eq("brand_id", brandId)
    .maybeSingle();

  const { data: docRows, error: docErr } = await supabase
    .from("brand_documents")
    .select("processing_status")
    .eq("brand_id", brandId);

  if (docErr) {
    throw new Error(docErr.message);
  }

  const docStats = {
    total: 0,
    uploaded: 0,
    pending: 0,
    processing: 0,
    ready: 0,
    failed: 0,
  };
  for (const row of docRows ?? []) {
    docStats.total += 1;
    const s = row.processing_status;
    if (s === "uploaded") docStats.uploaded += 1;
    else if (s === "pending") docStats.pending += 1;
    else if (s === "processing") docStats.processing += 1;
    else if (s === "ready") docStats.ready += 1;
    else if (s === "failed") docStats.failed += 1;
  }
  const pendingForReading = docStats.uploaded + docStats.pending;

  const diagnosisState = await fetchBrandDashboardDiagnosisState(supabase, brandId);
  const basesState = await fetchBrandDashboardBasesState(supabase, brandId);
  const pendingFacts = diagnosisState.pendingFactsCount;
  const hasActiveDiagnosis = diagnosisState.hasActiveDiagnosis;
  const diagnosisIsStale = diagnosisState.diagnosisIsStale;

  const documentsHref = `/brands/${brandId}/documents`;

  const hasActiveBases =
    basesState.hasActiveKnowledgeBase && basesState.hasActiveLimbicBase;
  const basesStale =
    basesState.knowledgeBaseIsStale || basesState.limbicBaseIsStale;

  const maintenance = resolveBrandDashboardMaintenance({
    brandId,
    pendingFactsCount: pendingFacts,
    consolidationRunning: basesState.consolidationRunning,
    hasActiveDiagnosis,
    diagnosisIsStale,
    hasActiveBases,
    basesStale,
  });

  const secondaryLinks = buildBrandDashboardMaintenanceSecondaryLinks(brandId);

  const overallScore = diagnosisState.activeDiagnosis?.overall_score ?? null;
  const diagnosisGeneratedAtBogota = diagnosisState.activeDiagnosis?.created_at
    ? formatBogotaDateTime(diagnosisState.activeDiagnosis.created_at)
    : null;
  const baseConsolidatedAtBogota = basesState.activeKnowledgeCreatedAt
    ? formatBogotaDateTime(basesState.activeKnowledgeCreatedAt)
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href="/brands">
          <ArrowLeft className="size-4" aria-hidden />
          Marcas
        </Link>
      </Button>

      <div className={cn(limbiDocumentCardClass, "space-y-6 p-6 sm:p-8")}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Marca
          </p>
          <h1 className="font-heading text-2xl font-semibold text-limbi-text">
            {brand.name}
          </h1>
          <p className="text-sm text-limbi-muted">
            <span className="font-medium text-limbi-text">Naturaleza:</span>{" "}
            {offerNatureLabelEs(profile?.offer_nature ?? null)}
          </p>
          <p className="text-sm text-limbi-muted">
            <span className="font-medium text-limbi-text">Estado:</span>{" "}
            {brandStatusLabel(brand.brand_status)}
          </p>
        </header>

        {brand.description ? (
          <p className="text-sm leading-relaxed text-limbi-text">
            {brand.description}
          </p>
        ) : null}

        {(brand.website_url || brand.country_or_market) && (
          <dl className="grid gap-2 text-sm text-limbi-muted">
            {brand.website_url ? (
              <div>
                <dt className="font-medium text-limbi-text">Web</dt>
                <dd>
                  <a
                    href={brand.website_url}
                    className="text-limbi-green underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {brand.website_url}
                  </a>
                </dd>
              </div>
            ) : null}
            {brand.country_or_market ? (
              <div>
                <dt className="font-medium text-limbi-text">Mercado / país</dt>
                <dd>{brand.country_or_market}</dd>
              </div>
            ) : null}
          </dl>
        )}

        <BrandDashboardMaintenanceClient
          brandId={brandId}
          maintenance={maintenance}
          secondaryLinks={secondaryLinks}
          hasActiveDiagnosis={hasActiveDiagnosis}
          diagnosisIsStale={diagnosisIsStale}
          overallScore={overallScore}
          diagnosisGeneratedAtBogota={diagnosisGeneratedAtBogota}
          baseConsolidatedAtBogota={baseConsolidatedAtBogota}
          hasActiveBases={hasActiveBases}
          activeDiagnosisEvaluationId={diagnosisState.activeDiagnosis?.id ?? null}
        />

        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-4 border border-limbi-border/90 bg-limbi-surface/30 p-4 sm:p-5",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-limbi-green/10 text-limbi-green">
              <FolderOpen className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-heading text-base font-semibold text-limbi-text">
                Material de contexto
              </h2>
              <p className="text-sm leading-relaxed text-limbi-muted">
                PDF, Word, texto o exploración web: Limbi lo usa como referencia y siempre pasa por
                tu revisión antes de influir en diagnóstico o bases.
              </p>
            </div>
          </div>
          {docStats.total === 0 ? (
            <p className="text-sm text-limbi-muted">
              Aún no has subido documentos de marca.
            </p>
          ) : (
            <p className="text-sm text-limbi-muted">
              {docStats.total}{" "}
              {docStats.total === 1 ? "documento subido" : "documentos subidos"} ·{" "}
              {[
                docStats.ready > 0
                  ? `${docStats.ready} ${
                      docStats.ready === 1 ? "con texto extraído" : "con texto extraído"
                    }`
                  : null,
                pendingForReading > 0
                  ? `${pendingForReading} ${
                      pendingForReading === 1
                        ? "pendiente de lectura"
                        : "pendientes de lectura"
                    }`
                  : null,
                docStats.processing > 0
                  ? `${docStats.processing} ${
                      docStats.processing === 1
                        ? "leyendo documento"
                        : "leyendo documentos"
                    }`
                  : null,
                docStats.failed > 0
                  ? `${docStats.failed} ${
                      docStats.failed === 1 ? "con error" : "con error"
                    }`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <Button className={limbiOutlineButtonClass} variant="outline" asChild>
            <Link href={documentsHref}>Gestionar documentos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
