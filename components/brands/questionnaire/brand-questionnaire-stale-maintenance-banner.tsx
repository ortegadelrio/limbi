import Link from "next/link";
import { cn } from "@/lib/utils";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";

type Props = {
  brandId: string;
  showDiagnosisCta: boolean;
  showBasesCta: boolean;
};

/** Aviso tras guardar respuestas o aprobar una mejora con Limbi. */
export function BrandQuestionnaireStaleMaintenanceBanner({
  brandId,
  showDiagnosisCta,
  showBasesCta,
}: Props) {
  if (!showDiagnosisCta && !showBasesCta) return null;

  return (
    <div
      className={cn(
        limbiDocumentCardClass,
        "border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950",
      )}
      role="status"
    >
      <p className="font-medium">Información de marca actualizada</p>
      {showDiagnosisCta ? (
        <p className="mt-1 leading-relaxed">
          El diagnóstico quedó desactualizado.{" "}
          <Link
            href={`/brands/${brandId}`}
            className="font-medium underline underline-offset-2"
          >
            Actualizar diagnóstico
          </Link>{" "}
          desde el dashboard.
        </p>
      ) : null}
      {showBasesCta ? (
        <p className="mt-1 leading-relaxed">
          La Base de Marca también quedó desactualizada. Cuando el diagnóstico esté al día,{" "}
          <Link
            href={`/brands/${brandId}/bases`}
            className="font-medium underline underline-offset-2"
          >
            Actualizar Base de Marca
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
