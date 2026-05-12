"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  limbiDocumentCardClass,
  limbiOutlineButtonClass,
  limbiPrimaryButtonClass,
} from "@/components/projects/limbi-ui";
import {
  BRAND_DOCUMENT_TYPE_OPTIONS,
  brandDocumentListStatusLabelEs,
  brandDocumentTypeLabelEs,
} from "@/lib/brands/brand-document-labels";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  BRAND_ANALYSIS_NO_USEFUL_HINT,
  BRAND_ANALYSIS_NO_USEFUL_PRIMARY,
} from "@/lib/brands/brand-document-analysis-empty-copy";
import { BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE } from "@/lib/schemas/brand-document-analysis";
import {
  BRAND_DOCUMENT_MAX_BYTES,
  BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS,
  validatePdfMagicBytesClient,
  validatePdfUploadMetadata,
} from "@/lib/brands/validate-pdf-upload";
import { cn } from "@/lib/utils";
import type { BrandDocumentListRow } from "@/types/database";

const BRAND_MATERIAL_CONTEXT_COPY =
  "Sube aquí documentos que ayuden a entender mejor la marca: manuales, briefs, presentaciones, portafolios, estudios o textos institucionales. Limbi los usará como fuente de contexto en etapas posteriores, pero no tomará su contenido como verdad automática sin revisión.";

const STORAGE_BUCKET = "brand-documents";

type Props = {
  brandId: string;
  brandName: string;
  initialDocuments: BrandDocumentListRow[];
  mode?: "standalone" | "embedded";
  onDocumentsChange?: (docs: BrandDocumentListRow[]) => void;
  /** En modo embedded: título y texto introductorio del paso (Ticket C). */
  embeddedSectionTitle?: string;
  embeddedSectionIntro?: string;
  embeddedFutureNote?: string;
};

type UploadErrorJson = {
  error?: string;
  code?: string;
  stage?: string;
  detail?: string;
};

type MaterialEmbeddedPhase =
  | "preparing"
  | "pending_review"
  | "analyzing"
  | "empty_findings"
  | "no_docs"
  | "uploading"
  | "reading"
  | "uploaded_pending"
  | "ready_analyze"
  | "waiting_docs";

type PrepareUploadResponse = {
  document: BrandDocumentListRow;
  storage_path: string;
  signed_url: string;
  token: string;
  path: string;
};

function formatUploadError(j: UploadErrorJson, fallback: string): string {
  const base = j.error ?? fallback;
  const tech =
    j.detail && j.detail !== j.error
      ? `\n\nDetalle (${j.stage ?? "?"}/${j.code ?? "?"}): ${j.detail}`
      : j.code
        ? `\n\nReferencia: ${j.stage ?? "?"}/${j.code}`
        : "";
  return `${base}${tech}`;
}

export function BrandDocumentsClient({
  brandId,
  brandName,
  initialDocuments,
  mode = "standalone",
  onDocumentsChange,
  embeddedSectionTitle,
  embeddedSectionIntro,
  embeddedFutureNote,
}: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentType, setDocumentType] = useState<string>("brief");
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingReview, setHasPendingReview] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);
  const [analyzingDocuments, setAnalyzingDocuments] = useState(false);
  /** Resultado válido: análisis sin hallazgos útiles (no es error). */
  const [analysisEmptyUseful, setAnalysisEmptyUseful] = useState(false);

  const readyForAnalysisCount = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.processing_status === "ready" &&
          d.extraction_summary?.extraction_status === "succeeded",
      ).length,
    [documents],
  );

  const nonSelectableReadyCount = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.processing_status === "ready" &&
          d.extraction_summary?.extraction_status === "succeeded_empty",
      ).length,
    [documents],
  );

  const materialEmbeddedPhase = useMemo((): MaterialEmbeddedPhase | null => {
    if (mode !== "embedded") return null;
    if (checkingPending) return "preparing";
    if (hasPendingReview) return "pending_review";
    if (analyzingDocuments) return "analyzing";
    if (analysisEmptyUseful) return "empty_findings";
    if (documents.length === 0 && !uploading) return "no_docs";
    if (uploading) return "uploading";
    const reading =
      extractingId !== null ||
      documents.some((d) => d.processing_status === "processing");
    if (reading) return "reading";
    const uploadedPending = documents.some(
      (d) =>
        d.processing_status === "uploaded" ||
        d.processing_status === "pending",
    );
    if (uploadedPending) return "uploaded_pending";
    if (readyForAnalysisCount > 0) return "ready_analyze";
    return "waiting_docs";
  }, [
    mode,
    checkingPending,
    hasPendingReview,
    analyzingDocuments,
    analysisEmptyUseful,
    documents,
    uploading,
    extractingId,
    readyForAnalysisCount,
  ]);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCheckingPending(true);
      try {
        const res = await fetch(
          `/api/brands/${brandId}/source-facts?status=pending_review`,
          { credentials: "include" },
        );
        const j = (await res.json().catch(() => ({}))) as {
          facts?: unknown[];
        };
        if (!cancelled && res.ok && Array.isArray(j.facts)) {
          setHasPendingReview(j.facts.length > 0);
        }
      } finally {
        if (!cancelled) setCheckingPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, documents]);

  async function refreshList() {
    const res = await fetch(`/api/brands/${brandId}/documents`, {
      credentials: "include",
    });
    const j = (await res.json().catch(() => ({}))) as {
      documents?: BrandDocumentListRow[];
      error?: string;
    };
    if (res.ok && j.documents) {
      setDocuments(j.documents);
      onDocumentsChange?.(j.documents);
    }
    const pr = await fetch(
      `/api/brands/${brandId}/source-facts?status=pending_review`,
      { credentials: "include" },
    );
    const pj = (await pr.json().catch(() => ({}))) as { facts?: unknown[] };
    if (pr.ok && Array.isArray(pj.facts)) {
      setHasPendingReview(pj.facts.length > 0);
    }
    router.refresh();
  }

  async function onAnalyzeDocuments() {
    setError(null);
    setMessage(null);
    setAnalysisEmptyUseful(false);
    setAnalyzingDocuments(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/documents/analyze`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        facts_created?: unknown[];
        analysis_result?: "findings_found" | "no_useful_findings" | null;
        empty_findings?: { primary: string; hint: string } | null;
        batch?: {
          status?: string;
          findings_count?: number;
          id?: string;
          error_message?: string | null;
          analysis_result?: "findings_found" | "no_useful_findings" | null;
        };
        message?: string;
      };
      const structureInvalid =
        j.code === BRAND_DOCUMENT_ANALYSIS_AI_OUTPUT_STRUCTURE_CODE;
      if (res.status === 409 && j.code === "pending_review_blocking") {
        setHasPendingReview(true);
        setMessage(null);
        throw new Error(
          j.error ??
            "Hay hallazgos pendientes de revisión. Revísalos antes de un nuevo análisis.",
        );
      }
      if (!res.ok) {
        throw new Error(
          structureInvalid
            ? "Limbi no pudo estructurar correctamente el análisis del documento. Puedes intentar de nuevo."
            : (j.error ?? "No se pudo analizar los documentos."),
        );
      }
      if (j.ok === false) {
        throw new Error(
          structureInvalid
            ? "Limbi no pudo estructurar correctamente el análisis del documento. Puedes intentar de nuevo."
            : (j.batch?.error_message?.trim() ||
                j.error ||
                "El análisis falló. Revisa la configuración o inténtalo más tarde."),
        );
      }
      const n = Array.isArray(j.facts_created) ? j.facts_created.length : 0;
      const batchAr = j.batch?.analysis_result ?? j.analysis_result;
      const noUsefulOutcome =
        j.batch?.status === "succeeded" &&
        n === 0 &&
        batchAr === "no_useful_findings";

      if (noUsefulOutcome) {
        setAnalysisEmptyUseful(true);
        setMessage(null);
        setHasPendingReview(false);
      } else {
        setAnalysisEmptyUseful(false);
        setMessage(
          n > 0
            ? `Limbi propuso ${n} hallazgo(s). Revísalos en la bandeja.`
            : (j.message ??
                "No se generaron hallazgos en esta pasada. Si hubo errores por documento, revisa el mensaje de error."),
        );
        setHasPendingReview(n > 0);
      }
      await refreshList();
      if (j.batch?.id && j.batch.status === "succeeded" && n > 0) {
        router.push(`/brands/${brandId}/source-facts`);
      }
    } catch (err) {
      setAnalysisEmptyUseful(false);
      setError(err instanceof Error ? err.message : "Error al analizar documentos.");
      await refreshList();
    } finally {
      setAnalyzingDocuments(false);
    }
  }

  async function markUploadFailed(documentId: string, errorMessage: string) {
    await fetch(`/api/brands/${brandId}/documents/${documentId}/complete-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "failed", error: errorMessage }),
    });
    await refreshList();
  }

  async function onExtractText(documentId: string) {
    setError(null);
    setMessage(null);
    setAnalysisEmptyUseful(false);
    setExtractingId(documentId);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/documents/${documentId}/extract-text`,
        { method: "POST", credentials: "include" },
      );
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        extraction?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo extraer el texto del PDF.");
      }
      setMessage(
        j.extraction?.message ??
          "Texto extraído correctamente. Este documento quedó listo para ser analizado en el siguiente paso.",
      );
      await refreshList();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al leer el documento para su análisis.",
      );
      await refreshList();
    } finally {
      setExtractingId(null);
    }
  }

  function renderExtractionBlock(d: BrandDocumentListRow) {
    const ex = d.extraction_summary;
    const isExtracting = extractingId === d.id;

    if (d.processing_status === "processing") {
      return (
        <div className="mt-2 flex items-start gap-2 text-xs text-limbi-muted">
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden />
          <div>
            <p>Leyendo documento… Esto puede tardar unos segundos según el tamaño del archivo.</p>
          </div>
        </div>
      );
    }

    if (d.processing_status === "ready" && ex?.extraction_status === "succeeded") {
      const pages = ex.page_count != null ? `${ex.page_count} páginas` : "— páginas";
      const chars =
        ex.character_count != null
          ? `${ex.character_count.toLocaleString("es")} caracteres`
          : "— caracteres";
      return (
        <div className="mt-2 space-y-1 text-xs text-limbi-muted">
          <p className="font-medium text-[var(--limbi-green)]">Texto extraído</p>
          <p>
            {pages} · {chars}
          </p>
          <p>Listo para análisis posterior.</p>
          {ex.truncated ? (
            <p className="text-amber-700 dark:text-amber-400">
              Texto truncado para procesamiento (límite{" "}
              {BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS.toLocaleString("es")} caracteres).
            </p>
          ) : null}
        </div>
      );
    }

    if (d.processing_status === "ready" && ex?.extraction_status === "succeeded_empty") {
      return (
        <div className="mt-2 space-y-1 text-xs leading-relaxed text-limbi-muted">
          <p className="font-medium text-limbi-text">Sin texto seleccionable</p>
          <p>
            {ex.summary_message ??
              "No se encontró texto seleccionable en este PDF. Puede ser un documento escaneado. El OCR quedará para una versión posterior."}
          </p>
        </div>
      );
    }

    if (d.processing_status === "failed") {
      return (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-red-600">
            No se pudo leer
            {d.processing_error ? `: ${d.processing_error}` : "."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(limbiOutlineButtonClass, "gap-1")}
            disabled={Boolean(extractingId)}
            onClick={() => void onExtractText(d.id)}
          >
            {isExtracting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Reintentar extracción
          </Button>
        </div>
      );
    }

    return null;
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setMessage(null);
    setAnalysisEmptyUseful(false);
    setUploading(true);

    const metaQuick = validatePdfUploadMetadata({
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type,
    });
    if (!metaQuick.ok) {
      setError(
        metaQuick.detail
          ? `${metaQuick.message}\n\n${metaQuick.detail}`
          : metaQuick.message,
      );
      setUploading(false);
      return;
    }

    const magic = await validatePdfMagicBytesClient(file);
    if (!magic.ok) {
      setError(magic.detail ? `${magic.message}\n\n${magic.detail}` : magic.message);
      setUploading(false);
      return;
    }

    let documentId: string | null = null;
    try {
      const prep = await fetch(`/api/brands/${brandId}/documents/prepare-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          document_type: documentType,
        }),
      });
      const pj = (await prep.json().catch(() => ({}))) as UploadErrorJson &
        Partial<PrepareUploadResponse>;
      if (!prep.ok) {
        console.warn("[Limbi brand-documents] prepare-upload error", {
          httpStatus: prep.status,
          ...pj,
        });
        throw new Error(formatUploadError(pj, "No se pudo preparar la subida."));
      }
      if (!pj.document || !pj.token || !pj.path) {
        throw new Error("Respuesta inválida del servidor al preparar la subida.");
      }
      documentId = pj.document.id;

      const supabase = createBrowserSupabaseClient();
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(pj.path, pj.token, file, {
          contentType: "application/pdf",
        });

      if (uploadErr) {
        console.warn("[Limbi brand-documents] uploadToSignedUrl error", uploadErr);
        await markUploadFailed(
          documentId,
          `Subida directa a Storage: ${uploadErr.message}`,
        );
        throw new Error(
          `No se pudo subir el archivo al almacenamiento: ${uploadErr.message}`,
        );
      }

      const comp = await fetch(
        `/api/brands/${brandId}/documents/${documentId}/complete-upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: "{}",
        },
      );
      const cj = (await comp.json().catch(() => ({}))) as UploadErrorJson & {
        document?: BrandDocumentListRow;
      };
      if (!comp.ok) {
        console.warn("[Limbi brand-documents] complete-upload error", {
          httpStatus: comp.status,
          ...cj,
        });
        await refreshList();
        throw new Error(formatUploadError(cj, "No se pudo completar la subida."));
      }

      setMessage(
        "Documento subido. Limbi está leyendo el PDF para preparar el análisis posterior.",
      );
      await refreshList();
      if (documentId) {
        void onExtractText(documentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir.");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (
      !window.confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    setAnalysisEmptyUseful(false);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/brands/${brandId}/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo eliminar.");
      }
      setMessage("Documento eliminado.");
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  const embedded = mode === "embedded";

  function triggerMaterialUploadClick() {
    document.getElementById("brand-material-upload-input")?.click();
  }

  const documentsListSection = (
    <div className={cn(limbiDocumentCardClass, "p-6 sm:p-8")}>
      <h3 className="text-sm font-semibold text-limbi-text">Documentos subidos</h3>
      {documents.length === 0 ? (
        <p className="mt-3 text-sm text-limbi-muted">
          Todavía no hay documentos. Sube un PDF para empezar; luego puedes añadir más.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-limbi-border">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-limbi-text">{d.file_name}</p>
                <p className="text-xs text-limbi-muted">
                  {brandDocumentTypeLabelEs(d.document_type)} ·{" "}
                  {brandDocumentListStatusLabelEs(d.processing_status)}
                  {d.file_size_bytes != null
                    ? ` · ${(d.file_size_bytes / 1024).toFixed(0)} KB`
                    : null}
                </p>
                {renderExtractionBlock(d)}
                {d.processing_error && d.processing_status !== "failed" ? (
                  <p className="mt-1 text-xs text-red-600">{d.processing_error}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(limbiOutlineButtonClass, "shrink-0 gap-1 self-start")}
                disabled={deletingId === d.id}
                onClick={() => void onDelete(d.id)}
              >
                {deletingId === d.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4" aria-hidden />
                )}
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const embeddedMaterialUploadControls = (
    <>
      <div className="space-y-2">
        <label htmlFor="doc-type" className="text-sm font-medium text-limbi-text">
          Tipo de documento
        </label>
        <select
          id="doc-type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={uploading}
          className="flex h-10 w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
        >
          {BRAND_DOCUMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-limbi-muted">
        Tamaño máximo: {BRAND_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB. Solo PDF.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className={cn(limbiPrimaryButtonClass, "relative")}
          disabled={uploading}
          asChild
        >
          <label
            htmlFor="brand-material-upload-input"
            className="inline-flex cursor-pointer items-center gap-2"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Subir documentos
          </label>
        </Button>
      </div>
    </>
  );

  const inner = (
    <div className="space-y-6">
      {!embedded ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
            Material de contexto
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-limbi-text">
            Documentos de marca
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-limbi-muted">
            {BRAND_MATERIAL_CONTEXT_COPY}
          </p>
        </div>
      ) : (
        <div>
          <h2 className="font-heading text-lg font-semibold text-limbi-text">
            {embeddedSectionTitle ?? "Material de contexto"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-limbi-muted">
            {embeddedSectionIntro ?? BRAND_MATERIAL_CONTEXT_COPY}
          </p>
          {embeddedFutureNote ? (
            <p className="mt-2 text-xs leading-relaxed text-limbi-muted">
              {embeddedFutureNote}
            </p>
          ) : null}
        </div>
      )}

      {embedded && materialEmbeddedPhase ? (
        <>
          <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-limbi-muted">
              {materialEmbeddedPhase === "preparing"
                ? "Preparando"
                : materialEmbeddedPhase === "pending_review"
                  ? "Revisión"
                  : materialEmbeddedPhase === "analyzing"
                    ? "Análisis"
                    : materialEmbeddedPhase === "empty_findings"
                      ? "Resultado"
                      : materialEmbeddedPhase === "no_docs"
                        ? "Documentos"
                        : materialEmbeddedPhase === "uploading"
                          ? "Subida"
                          : materialEmbeddedPhase === "reading"
                            ? "Lectura"
                            : materialEmbeddedPhase === "uploaded_pending"
                              ? "Documento"
                              : materialEmbeddedPhase === "ready_analyze"
                                ? "Listo"
                                : "Documentos"}
            </p>
            {materialEmbeddedPhase === "preparing" ? (
              <p className="text-sm text-limbi-muted">
                Comprobando si hay hallazgos pendientes…
              </p>
            ) : null}
            {materialEmbeddedPhase === "pending_review" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">
                  Hay información sugerida esperando tu revisión
                </h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Revisa y aprueba o descarta los hallazgos antes de lanzar un nuevo análisis.
                </p>
                <Button className={limbiPrimaryButtonClass} asChild>
                  <Link href={`/brands/${brandId}/source-facts`}>
                    Revisar hallazgos
                  </Link>
                </Button>
              </>
            ) : null}
            {materialEmbeddedPhase === "analyzing" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">
                  Limbi está analizando los documentos
                </h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Esto puede tardar según el número y tamaño de los PDF.
                </p>
                <Button
                  type="button"
                  className={cn(limbiPrimaryButtonClass, "pointer-events-none opacity-80")}
                  disabled
                >
                  <Loader2 className="mr-2 size-4 shrink-0 animate-spin" aria-hidden />
                  Analizando…
                </Button>
              </>
            ) : null}
            {materialEmbeddedPhase === "empty_findings" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">
                  Sin hallazgos nuevos
                </h3>
                <p className="text-sm text-limbi-text">{BRAND_ANALYSIS_NO_USEFUL_PRIMARY}</p>
                <p className="text-xs leading-relaxed text-limbi-muted">
                  {BRAND_ANALYSIS_NO_USEFUL_HINT}
                </p>
              </>
            ) : null}
            {materialEmbeddedPhase === "no_docs" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">Sin documentos</h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Este paso es opcional. Puedes continuar sin documentos.
                </p>
              </>
            ) : null}
            {materialEmbeddedPhase === "uploading" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">Subiendo documento</h3>
                <p className="text-sm text-limbi-muted">
                  Espera un momento mientras se guarda el archivo…
                </p>
              </>
            ) : null}
            {materialEmbeddedPhase === "reading" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">Leyendo documento</h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Este paso prepara el análisis. No necesitas hacer nada.
                </p>
                <div className="flex items-center gap-2 text-sm text-limbi-muted">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Extrayendo texto del PDF…
                </div>
              </>
            ) : null}
            {materialEmbeddedPhase === "uploaded_pending" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">Documento subido</h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Limbi está preparando la lectura del archivo…
                </p>
                <div className="flex items-center gap-2 text-sm text-limbi-muted">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  En cola de lectura
                </div>
              </>
            ) : null}
            {materialEmbeddedPhase === "ready_analyze" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">Documento leído</h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Limbi puede revisar los documentos y proponerte hallazgos para aprobación.
                </p>
                <Button
                  type="button"
                  className={cn(limbiPrimaryButtonClass, "inline-flex items-center gap-2")}
                  disabled={
                    analyzingDocuments ||
                    readyForAnalysisCount === 0 ||
                    Boolean(uploading) ||
                    Boolean(extractingId)
                  }
                  onClick={() => void onAnalyzeDocuments()}
                >
                  Analizar documentos
                </Button>
              </>
            ) : null}
            {materialEmbeddedPhase === "waiting_docs" ? (
              <>
                <h3 className="text-base font-semibold text-limbi-text">Tus documentos</h3>
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Cuando haya texto extraído listo, podrás pedir un análisis. Si un archivo falló,
                  puedes reintentar la lectura o eliminarlo desde la lista.
                </p>
                {nonSelectableReadyCount > 0 ? (
                  <p className="text-xs text-limbi-muted">
                    {nonSelectableReadyCount}{" "}
                    {nonSelectableReadyCount === 1
                      ? "documento no tiene texto seleccionable y no podrá analizarse todavía."
                      : "documentos no tienen texto seleccionable y no podrán analizarse todavía."}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          {(materialEmbeddedPhase === "no_docs" ||
            materialEmbeddedPhase === "uploading") && (
            <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
              <h3 className="text-sm font-semibold text-limbi-text">Subir PDF</h3>
              {embeddedMaterialUploadControls}
            </div>
          )}

          {materialEmbeddedPhase !== "no_docs" &&
            materialEmbeddedPhase !== "uploading" && (
              <div
                className={cn(
                  limbiDocumentCardClass,
                  "flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5",
                )}
              >
                <p className="text-sm text-limbi-muted">¿Quieres añadir otro PDF?</p>
                <Button
                  type="button"
                  variant="outline"
                  className={limbiOutlineButtonClass}
                  disabled={uploading}
                  onClick={triggerMaterialUploadClick}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="size-4" aria-hidden />
                  )}
                  Subir otro PDF
                </Button>
              </div>
            )}

          <input
            type="file"
            accept="application/pdf,.pdf,application/x-pdf,application/octet-stream"
            id="brand-material-upload-input"
            className="sr-only"
            disabled={uploading}
            onChange={(ev) => void onUpload(ev)}
          />
        </>
      ) : (
        <>
          <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
            <h3 className="text-sm font-semibold text-limbi-text">Análisis de documentos</h3>
            {checkingPending ? (
              <p className="text-xs text-limbi-muted">Comprobando hallazgos pendientes…</p>
            ) : hasPendingReview ? (
              <div className="space-y-3">
                <p className="text-sm text-limbi-muted">
                  Tienes hallazgos pendientes de revisión. Revísalos antes de lanzar un nuevo
                  análisis.
                </p>
                <Button className={limbiPrimaryButtonClass} asChild>
                  <Link href={`/brands/${brandId}/source-facts`}>
                    Revisar hallazgos pendientes
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-limbi-muted">
                  Limbi revisará todos los documentos con texto extraído y propondrá hallazgos
                  por sección para que decidas qué incluir en la Base de Marca.
                </p>
                {readyForAnalysisCount > 0 ? (
                  <p className="text-sm font-medium text-limbi-text">
                    {readyForAnalysisCount}{" "}
                    {readyForAnalysisCount === 1
                      ? "documento listo para análisis"
                      : "documentos listos para análisis"}
                  </p>
                ) : (
                  <p className="text-sm text-limbi-muted">
                    Aún no hay documentos con texto extraído listo para analizar.
                  </p>
                )}
                {nonSelectableReadyCount > 0 ? (
                  <p className="text-xs text-limbi-muted">
                    {nonSelectableReadyCount}{" "}
                    {nonSelectableReadyCount === 1
                      ? "documento no tiene texto seleccionable y no podrá analizarse todavía."
                      : "documentos no tienen texto seleccionable y no podrán analizarse todavía."}
                  </p>
                ) : null}
                <Button
                  type="button"
                  className={cn(limbiPrimaryButtonClass, "inline-flex items-center gap-2")}
                  disabled={
                    analyzingDocuments ||
                    readyForAnalysisCount === 0 ||
                    Boolean(uploading) ||
                    Boolean(extractingId)
                  }
                  onClick={() => void onAnalyzeDocuments()}
                >
                  {analyzingDocuments ? (
                    <>
                      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                      Limbi está analizando los documentos…
                    </>
                  ) : (
                    "Analizar documentos"
                  )}
                </Button>
                {analyzingDocuments ? (
                  <p className="text-xs text-limbi-muted">
                    Limbi está analizando los documentos y comparándolos con la información de la
                    marca… Esto puede tardar según el número y tamaño del PDF.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className={cn(limbiDocumentCardClass, "space-y-4 p-6 sm:p-8")}>
            <h3 className="text-sm font-semibold text-limbi-text">Subir PDF</h3>
            <div className="space-y-2">
              <label htmlFor="doc-type" className="text-sm font-medium text-limbi-text">
                Tipo de documento
              </label>
              <select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={uploading}
                className="flex h-10 w-full rounded-xl border border-limbi-border bg-limbi-surface px-3 py-2 text-sm text-limbi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limbi-green/35"
              >
                {BRAND_DOCUMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-limbi-muted">
              Tamaño máximo: {BRAND_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB. Puedes subir varios
              PDFs; cada uno aparecerá en la lista con su propio estado.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className={cn(limbiPrimaryButtonClass, "relative")}
                disabled={uploading}
                asChild
              >
                <label className="inline-flex cursor-pointer items-center gap-2">
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="size-4" aria-hidden />
                  )}
                  Elegir PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf,application/x-pdf,application/octet-stream"
                    id="brand-material-upload-input"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(ev) => void onUpload(ev)}
                  />
                </label>
              </Button>
            </div>
          </div>
        </>
      )}

      {error ? (
        <div
          className={cn(
            limbiDocumentCardClass,
            "space-y-3 border-red-200/80 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20",
          )}
          role="alert"
        >
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            No se pudo completar la acción
          </h3>
          <p className="whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={limbiOutlineButtonClass}
              onClick={() => {
                setError(null);
                triggerMaterialUploadClick();
              }}
            >
              Intentar subir de nuevo
            </Button>
          </div>
        </div>
      ) : null}
      {!embedded && analysisEmptyUseful ? (
        <div className="space-y-2 rounded-xl border border-limbi-border bg-limbi-bg-soft/60 p-4">
          <p className="text-sm font-medium text-limbi-text">{BRAND_ANALYSIS_NO_USEFUL_PRIMARY}</p>
          <p className="text-xs leading-relaxed text-limbi-muted">{BRAND_ANALYSIS_NO_USEFUL_HINT}</p>
        </div>
      ) : null}
      {!embedded && message ? (
        <p className="text-sm text-[var(--limbi-green)]">{message}</p>
      ) : null}
      {embedded && message && materialEmbeddedPhase !== "empty_findings" ? (
        <p className="text-sm text-[var(--limbi-green)]">{message}</p>
      ) : null}

      {documentsListSection}
    </div>
  );

  if (embedded) {
    return <div className="w-full">{inner}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 gap-1 rounded-xl" asChild>
        <Link href={`/brands/${brandId}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {brandName}
        </Link>
      </Button>
      {inner}
    </div>
  );
}
