import {
  OFFERING_TYPE_OPTIONS,
  PROBLEM_CATEGORY_OPTIONS,
  TRANSFORMATION_TYPE_OPTIONS,
} from "@/lib/constants/wizard";

function readStrategicBase(
  responses: Record<string, unknown>,
): Record<string, unknown> {
  const sb = responses.strategic_base;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    return sb as Record<string, unknown>;
  }
  return {};
}

function optionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  const hit = options.find((o) => o.value === value);
  return hit?.label ?? null;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** User-facing summary only — no DB paths, keys, or internal field names. */
export type OfferingPilotSummary = {
  understood: string[];
  weak: string[];
  /** When true, show weak bullets; otherwise show the “no alerts” line. */
  showWeakSection: boolean;
  pendingInfoNote: string | null;
  limbiUseParagraph: string;
};

const PENDING_INFO_COPY =
  "Este punto quedó marcado como información pendiente. Limbi lo tendrá en cuenta para no inventar beneficios ni hacer promesas fuertes.";

const LIMBI_USE_COPY =
  "Esta información ayudará a construir la base de valor del proyecto y a evitar que Limbi invente beneficios o promesas que no estén claras.";

const NO_ALERTS_COPY =
  "Por ahora no hay alertas importantes en este módulo.";

const UNDERSTOOD_FALLBACK =
  "Aún estamos definiendo los matices; seguiremos en los próximos pasos.";

type FieldKey =
  | "simple_description"
  | "offering_type"
  | "problem_category"
  | "problem_description_optional"
  | "transformation_type";

const WEAK_HINT: Record<FieldKey, string> = {
  simple_description:
    "La esencia de lo que ofreces conviene afinarla con un poco más de detalle.",
  offering_type:
    "El tipo de oferta quedó poco claro; lo puliremos en los siguientes pasos.",
  problem_category:
    "El problema principal que resuelves conviene precisarlo mejor.",
  problem_description_optional:
    "El detalle del problema o deseo del cliente puede ampliarse.",
  transformation_type:
    "La transformación que prometes conviene expresarla con más claridad.",
};

export function buildOfferingPilotSummary(
  mergedResponses: Record<string, unknown>,
  confidence: Record<string, number>,
): OfferingPilotSummary {
  const sb = readStrategicBase(mergedResponses);
  const understood: string[] = [];
  const weak: string[] = [];

  const conf = (path: string) => confidence[path] ?? 0.72;

  const simple =
    typeof sb.simple_description === "string"
      ? sb.simple_description.trim()
      : "";
  if (simple) {
    if (conf("strategic_base.simple_description") < 0.55) {
      weak.push(WEAK_HINT.simple_description);
    } else {
      understood.push(`Tu oferta en una frase: «${truncate(simple, 160)}».`);
    }
  }

  const offType = optionLabel(OFFERING_TYPE_OPTIONS, sb.offering_type);
  if (offType) {
    if (conf("strategic_base.offering_type") < 0.55) {
      weak.push(WEAK_HINT.offering_type);
    } else {
      understood.push(`Lo entendimos como: ${offType}.`);
    }
  }

  const probCat = optionLabel(PROBLEM_CATEGORY_OPTIONS, sb.problem_category);
  if (probCat) {
    if (conf("strategic_base.problem_category") < 0.55) {
      weak.push(WEAK_HINT.problem_category);
    } else {
      understood.push(`El dolor o deseo del cliente encaja en: ${probCat}.`);
    }
  }

  const probDesc =
    typeof sb.problem_description_optional === "string"
      ? sb.problem_description_optional.trim()
      : "";
  if (probDesc) {
    if (conf("strategic_base.problem_description_optional") < 0.55) {
      weak.push(WEAK_HINT.problem_description_optional);
    } else {
      understood.push(
        `Sobre el contexto del problema: ${truncate(probDesc, 200)}`,
      );
    }
  }

  const trans = optionLabel(
    TRANSFORMATION_TYPE_OPTIONS,
    sb.transformation_type,
  );
  if (trans) {
    if (conf("strategic_base.transformation_type") < 0.55) {
      weak.push(WEAK_HINT.transformation_type);
    } else {
      understood.push(`La transformación que buscas comunicar: ${trans}.`);
    }
  }

  const lim = sb.guided_intake_limitations_optional;
  const hasLimitations = Array.isArray(lim) && lim.length > 0;

  const showWeakSection = weak.length > 0;

  if (understood.length === 0) {
    understood.push(UNDERSTOOD_FALLBACK);
  }

  return {
    understood,
    weak,
    showWeakSection,
    pendingInfoNote: hasLimitations ? PENDING_INFO_COPY : null,
    limbiUseParagraph: LIMBI_USE_COPY,
  };
}

/** Shown in “Lo que conviene mejorar” when there are no weak points. */
export const OFFERING_PILOT_NO_ALERTS_COPY = NO_ALERTS_COPY;
