/**
 * Secciones del cuestionario donde el inventario de oferta y territorios de audiencia
 * aporta contexto visible para la mejora asistida. En el resto, el bloque se oculta
 * para no saturar con datos estructurados que Limbi ya recibe por API.
 */
export function shouldShowStructuredBrandContextForImprove(sectionKey: string): boolean {
  const k = sectionKey.trim();
  return (
    k === "offer" ||
    k === "value_proposition" ||
    k === "audiences" ||
    k === "product_service" ||
    k === "product" ||
    k === "service" ||
    k === "digital_platform" ||
    k === "experience_event" ||
    k === "organization" ||
    k === "personal_brand"
  );
}
