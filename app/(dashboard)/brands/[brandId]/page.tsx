import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import { fetchBrandDashboardDiagnosisState } from "@/lib/brands/fetch-brand-dashboard-diagnosis-state";
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
  const pendingFacts = diagnosisState.pendingFactsCount;
  const hasActiveDiagnosis = diagnosisState.hasActiveDiagnosis;
  const diagnosisIsStale = diagnosisState.diagnosisIsStale;

  const materialQuestionnaireHref = `/brands/${brandId}/questionnaire?step=material_context`;
  const documentsHref = `/brands/${brandId}/documents`;
  const diagnosisHref = `/brands/${brandId}/diagnosis`;
  const sourceFactsHref = `/brands/${brandId}/source-facts`;

  const nextStepTitle = "Siguiente paso recomendado";
  let nextStepBody = "";
  let nextStepPrimaryHref = diagnosisHref;
  let nextStepPrimaryLabel = "Ver diagnóstico";

  if (pendingFacts > 0) {
    nextStepBody =
      "Hay información sugerida por documentos que debes aprobar, editar o descartar antes de generar el diagnóstico.";
    nextStepPrimaryHref = sourceFactsHref;
    nextStepPrimaryLabel = "Revisar hallazgos pendientes";
  } else if (!hasActiveDiagnosis) {
    nextStepBody =
      "La marca ya tiene información suficiente para generar una primera evaluación estratégica.";
    nextStepPrimaryHref = diagnosisHref;
    nextStepPrimaryLabel = "Generar diagnóstico";
  } else if (diagnosisIsStale) {
    nextStepBody =
      "Hay cambios recientes en la información de la marca. Actualiza la evaluación para reflejar la versión más nueva.";
    nextStepPrimaryHref = diagnosisHref;
    nextStepPrimaryLabel = "Actualizar diagnóstico";
  } else {
    nextStepBody = "Tu diagnóstico está actualizado con la información aprobada.";
    nextStepPrimaryHref = diagnosisHref;
    nextStepPrimaryLabel = "Ver diagnóstico";
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
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

        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-3 border border-limbi-border bg-limbi-bg-soft/40 p-4 sm:p-5",
          )}
        >
          <h2 className="text-sm font-semibold text-limbi-text">{nextStepTitle}</h2>
          <p className="text-sm leading-relaxed text-limbi-muted">{nextStepBody}</p>
          <Button className={limbiPrimaryButtonClass} asChild>
            <Link href={nextStepPrimaryHref}>{nextStepPrimaryLabel}</Link>
          </Button>
        </div>

        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-3 border border-limbi-border p-4 sm:p-5",
          )}
        >
          <h2 className="text-sm font-semibold text-limbi-text">Material de contexto</h2>
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
          <div className="flex flex-wrap gap-2">
            <Button className={limbiOutlineButtonClass} variant="outline" asChild>
              <Link href={documentsHref}>Gestionar documentos</Link>
            </Button>
            <Button variant="outline" className="rounded-xl border-limbi-border" asChild>
              <Link href={materialQuestionnaireHref}>Material en cuestionario</Link>
            </Button>
          </div>
        </div>

        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-3 border border-limbi-border p-4 sm:p-5",
          )}
        >
          <h2 className="text-sm font-semibold text-limbi-text">Diagnóstico de marca</h2>
          {pendingFacts > 0 ? (
            <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-limbi-text">
              Hay hallazgos de documentos pendientes de revisión. Resuélvelos antes de
              generar o actualizar el diagnóstico.
            </p>
          ) : (
            <p className="text-sm text-limbi-muted">Hallazgos de documentos revisados.</p>
          )}
          {hasActiveDiagnosis && diagnosisIsStale ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-limbi-text">
              El diagnóstico puede estar desactualizado.
            </p>
          ) : null}
          {hasActiveDiagnosis && !diagnosisIsStale && pendingFacts === 0 ? (
            <p className="text-sm text-limbi-muted">
              Tu evaluación activa refleja la información aprobada hasta ahora.
            </p>
          ) : null}
          {!hasActiveDiagnosis && pendingFacts === 0 ? (
            <p className="text-sm text-limbi-muted">
              Aún no hay un diagnóstico generado para esta marca.
            </p>
          ) : null}
          <Button variant="outline" className={limbiOutlineButtonClass} asChild>
            <Link href={diagnosisHref}>Ir a diagnóstico</Link>
          </Button>
        </div>

        <div className="space-y-2 border-t border-limbi-border pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-limbi-muted">
            Más acciones
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" className="rounded-xl border-limbi-border" asChild>
              <Link href={`/brands/${brandId}/questionnaire`}>Completar cuestionario</Link>
            </Button>
            <Button variant="outline" className="rounded-xl border-limbi-border" asChild>
              <Link href={documentsHref}>Gestionar documentos</Link>
            </Button>
            <Button variant="outline" className="rounded-xl border-limbi-border" asChild>
              <Link href={sourceFactsHref}>Ver hallazgos de documentos</Link>
            </Button>
          </div>
        </div>

        <p className="text-xs text-limbi-muted">
          Las bases activas de marca y la generación desde ellas llegarán en tickets posteriores.
        </p>
      </div>
    </div>
  );
}
