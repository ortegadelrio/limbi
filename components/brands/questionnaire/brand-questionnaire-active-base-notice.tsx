import { cn } from "@/lib/utils";
import { limbiDocumentCardClass } from "@/components/projects/limbi-ui";

/**
 * Aviso al editar respuestas originales cuando ya existe Base de Marca consolidada.
 * La base activa no se edita manualmente; se reconsolida desde fuentes aprobadas.
 */
export function BrandQuestionnaireActiveBaseNotice() {
  return (
    <div
      className={cn(
        limbiDocumentCardClass,
        "border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950",
      )}
      role="status"
    >
      <p className="font-medium">Esta marca ya tiene una Base de Marca consolidada.</p>
      <p className="mt-1 leading-relaxed text-amber-900/90">
        Estás editando el <strong className="font-medium">cuestionario original</strong>. Si guardás
        cambios, el diagnóstico y la Base de Marca quedarán desactualizados y deberás actualizarlos
        desde el dashboard. La Base de Marca activa{" "}
        <strong className="font-medium">no se edita a mano</strong>; se reconsolida.
      </p>
      <p className="mt-2 text-amber-900/90">
        Completá o corregí las respuestas aquí; después actualizá el diagnóstico y la Base de
        Marca desde el dashboard de la marca.
      </p>
    </div>
  );
}
