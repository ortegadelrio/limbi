/**
 * Acciones HTTP de mantenimiento de marca (compartidas entre dashboard interno y listado).
 */

export type BrandMaintenancePostResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export async function postBrandDiagnosis(brandId: string): Promise<BrandMaintenancePostResult> {
  const res = await fetch(`/api/brands/${brandId}/diagnosis`, {
    method: "POST",
    credentials: "include",
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
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
  return { ok: true };
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
