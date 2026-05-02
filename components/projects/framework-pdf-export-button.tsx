"use client";

import { useCallback, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limbiOutlineButtonClass } from "@/components/projects/limbi-ui";
import { cn } from "@/lib/utils";
import {
  buildFrameworkPrintDocumentHtml,
  formatFrameworkGeneratedTimestamp,
  type FrameworkPrintPayload,
} from "@/lib/projects/format-framework-for-print";

type Props = {
  framework: FrameworkPrintPayload;
  version: number;
  projectDisplayName: string;
  userDisplayName: string;
  className?: string;
};

/**
 * Imprime el marco sin ventana emergente: iframe fuera de vista con documento
 * escrito vía `document.write` (más fiable que `blob:` + `print`, que a veces sale en blanco).
 * El iframe debe tener tamaño no nulo o varios navegadores imprimen vacío.
 */
export function FrameworkPdfExportButton({
  framework,
  version,
  projectDisplayName,
  userDisplayName,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handlePrint = useCallback(() => {
    setBusy(true);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Vista previa de impresión del Marco");
    iframe.setAttribute("aria-hidden", "true");
    /* Tamaño real pero fuera de pantalla: 0×0 suele producir PDF/impresión en blanco */
    iframe.style.cssText =
      "position:absolute;left:-9999px;top:0;width:816px;height:1200px;border:0;margin:0;padding:0;opacity:0;pointer-events:none";

    const cleanup = () => {
      iframe.remove();
    };

    try {
      const now = new Date();
      const html = buildFrameworkPrintDocumentHtml(framework, {
        platformLine: "Limbi — Plataforma Límbica digital",
        systemLine: `Sistema Límbico de ${projectDisplayName}`,
        userLine: `Documento generado por: ${userDisplayName}`,
        versionLine: `Marco Estratégico Límbico v${version}`,
        statusLine: "Estado: Aprobado",
        generatedLine: `Generado el ${formatFrameworkGeneratedTimestamp(now)}`,
      });

      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc) {
        cleanup();
        setBusy(false);
        window.alert(
          "No se pudo preparar la vista de impresión. Prueba con otro navegador.",
        );
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      const runPrint = () => {
        try {
          const done = () => cleanup();
          win.addEventListener("afterprint", done, { once: true });
          win.focus();
          win.print();
          window.setTimeout(() => {
            if (iframe.isConnected) cleanup();
          }, 120_000);
        } catch {
          cleanup();
          window.alert(
            "No se pudo abrir el cuadro de impresión. Usa Archivo → Imprimir desde el menú del navegador.",
          );
        } finally {
          setBusy(false);
        }
      };

      /* Breve pausa para que el motor de layout termine antes de print() */
      window.setTimeout(runPrint, 150);
    } catch (e) {
      cleanup();
      setBusy(false);
      window.alert(
        e instanceof Error ? e.message : "No se pudo preparar el documento.",
      );
    }
  }, [framework, projectDisplayName, userDisplayName, version]);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      onClick={handlePrint}
      className={cn("gap-2", limbiOutlineButtonClass, className)}
    >
      {busy ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <FileDown className="size-4 shrink-0" aria-hidden />
      )}
      Descargar / imprimir PDF
    </Button>
  );
}
