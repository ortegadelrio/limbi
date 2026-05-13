"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limbiPrimaryButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import type { BrandDashboardMaintenanceResolved } from "@/lib/brands/brand-dashboard-maintenance-action";
import {
  postBrandConsolidate,
  postBrandDiagnosis,
} from "@/lib/brands/brand-maintenance-api-actions";

type Props = {
  brandId: string;
  maintenance: BrandDashboardMaintenanceResolved;
  activeDiagnosisEvaluationId?: string | null;
};

export function BrandOverviewCardCta({
  brandId,
  maintenance,
  activeDiagnosisEvaluationId = null,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onPrimary = useCallback(async () => {
    setErrorMessage(null);
    const { primaryRole } = maintenance;

    if (
      (primaryRole === "review_pending_facts" || primaryRole === "view_brand") &&
      maintenance.primaryHref
    ) {
      return;
    }
    if (primaryRole === "blocked_busy" || primaryRole === "none_up_to_date") {
      return;
    }

    setBusy(true);
    try {
      if (primaryRole === "update_all") {
        const d = await postBrandDiagnosis(brandId);
        if (!d.ok) {
          setErrorMessage(d.error);
          return;
        }
        if (
          activeDiagnosisEvaluationId &&
          d.evaluation.id === activeDiagnosisEvaluationId
        ) {
          setErrorMessage(
            "El diagnóstico no se renovó; no consolidamos la Base de Marca para evitar datos desactualizados.",
          );
          await router.refresh();
          return;
        }
        const c = await postBrandConsolidate(brandId);
        if (!c.ok) {
          setErrorMessage(
            "El diagnóstico se actualizó, pero no pudimos consolidar la Base de Marca.",
          );
          await router.refresh();
          return;
        }
        await router.refresh();
        return;
      }

      if (primaryRole === "update_base_only" || primaryRole === "create_base") {
        const c = await postBrandConsolidate(brandId);
        if (!c.ok) {
          setErrorMessage(c.error);
          return;
        }
        await router.refresh();
        return;
      }

      if (primaryRole === "generate_diagnosis") {
        const d = await postBrandDiagnosis(brandId);
        if (!d.ok) {
          setErrorMessage(d.error);
          return;
        }
        await router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }, [brandId, maintenance, router, activeDiagnosisEvaluationId]);

  const isLink =
    (maintenance.primaryRole === "review_pending_facts" ||
      maintenance.primaryRole === "view_brand") &&
    maintenance.primaryHref;

  const disabled =
    busy ||
    maintenance.primaryRole === "blocked_busy" ||
    maintenance.primaryRole === "none_up_to_date";

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
      {errorMessage ? (
        <p className="max-w-full text-right text-xs text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLink ? (
        <Button className={cn(limbiPrimaryButtonClass, "w-full sm:w-auto")} asChild>
          <Link href={maintenance.primaryHref!}>{maintenance.primaryLabel}</Link>
        </Button>
      ) : (
        <Button
          type="button"
          className={cn(limbiPrimaryButtonClass, "min-h-11 w-full px-5 text-[15px] sm:w-auto")}
          disabled={disabled}
          onClick={() => void onPrimary()}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              {maintenance.primaryLabel}
            </>
          ) : (
            maintenance.primaryLabel
          )}
        </Button>
      )}
    </div>
  );
}
