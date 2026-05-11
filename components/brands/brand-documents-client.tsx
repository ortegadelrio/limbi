"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
};

type UploadErrorJson = {
  error?: string;
  code?: string;
  stage?: string;
  detail?: string;
};

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
}: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentType, setDocumentType] = useState<string>("brief");
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

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
    router.refresh();
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
          <p className="text-xs text-red-600">
            Error al leer documento
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
            Material de contexto
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-limbi-muted">
            {BRAND_MATERIAL_CONTEXT_COPY}
          </p>
        </div>
      )}

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

      {error ? (
        <p className="whitespace-pre-wrap text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--limbi-green)]">{message}</p>
      ) : null}

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
