/**
 * Acciones HTTP de mantenimiento de marca (compartidas entre dashboard interno y listado).
 */

export type BrandMaintenancePostResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export type BrandDiagnosisPostSuccess = {
  ok: true;
  evaluation: {
    id: string;
    created_at: string;
    status: string;
    is_active: boolean | null;
  };
  diagnosis_generated_at_bogota: string | null;
};

export type BrandMaintenanceDiagnosisPostResult =
  | BrandDiagnosisPostSuccess
  | { ok: false; error: string; code?: string };

export async function postBrandDiagnosis(
  brandId: string,
): Promise<BrandMaintenanceDiagnosisPostResult> {
  const res = await fetch(`/api/brands/${brandId}/diagnosis`, {
    method: "POST",
    credentials: "include",
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    evaluation?: {
      id: string;
      created_at: string;
      status: string;
      is_active: boolean | null;
    };
    diagnosis_generated_at_bogota?: string | null;
  };
  if (res.status === 409 && j.code === "pending_review_blocking") {
    return { ok: false, error: "Primero revisa los hallazgos pendientes.", code: j.code };
  }
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof j.error === "string"
          ? j.error
          : "No pudimos actualizar el diagnóstico. Intenta de nuevo.",
      code: j.code,
    };
  }
  const ev = j.evaluation;
  if (!ev?.id || !ev.created_at || ev.status !== "succeeded" || ev.is_active !== true) {
    return {
      ok: false,
      error: "El diagnóstico no quedó activo correctamente. Intenta de nuevo.",
      code: "diagnosis_incomplete_response",
    };
  }
  return {
    ok: true,
    evaluation: {
      id: ev.id,
      created_at: ev.created_at,
      status: ev.status,
      is_active: ev.is_active,
    },
    diagnosis_generated_at_bogota:
      typeof j.diagnosis_generated_at_bogota === "string"
        ? j.diagnosis_generated_at_bogota
        : null,
  };
}

export async function postBrandConsolidate(brandId: string): Promise<BrandMaintenancePostResult> {
  const res = await fetch(`/api/brands/${brandId}/bases/consolidate`, {
    method: "POST",
    credentials: "include",
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof j.error === "string"
          ? j.error
          : "No pudimos consolidar la Base de Marca. Intenta de nuevo.",
      code: j.code,
    };
  }
  return { ok: true };
}
