import { CONTENT_GENERATION_USER_NOTE_MAX } from "@/lib/content/build-input";
import {
  buildContentGenerationInput,
  type BuildContentGenerationInputParams,
  type ContentGenerationStructuredInput,
} from "@/lib/content/build-input";

export const CONTENT_REFINEMENT_PROMPT_VERSION = "content-refinement-v1.2";

/** Máximo de `custom_refinement_note` (alineado con notas de generación). */
export const CONTENT_REFINEMENT_CUSTOM_NOTE_MAX = CONTENT_GENERATION_USER_NOTE_MAX;

export type RefinementPreset =
  | "more_direct"
  | "more_emotional"
  | "more_commercial"
  | "more_provocative"
  | "more_premium"
  | "clearer"
  | "less_institutional"
  | "shorter"
  | "more_punch"
  | "more_human"
  | "more_elegant";

export const REFINEMENT_PRESET_INSTRUCTIONS_ES: Record<RefinementPreset, string> = {
  more_direct:
    "Hacerlo más directo, menos rodeado y más fácil de entender.",
  more_emotional:
    "Aumentar la conexión emocional con sobriedad, sin cursilería ni exageración.",
  more_commercial:
    "Hacerlo más útil para vender o convencer, sin sonar agresivo ni vendedor barato.",
  more_provocative:
    "Darle más tensión, punto de vista y filo, sin volverse irresponsable.",
  more_premium:
    "Hacerlo más sofisticado, elegante y selectivo, sin hacerlo frío.",
  clearer:
    "Hacerlo más claro, concreto y fácil de comprender.",
  less_institutional:
    "Quitar tono institucional, burocrático o corporativo genérico.",
  shorter:
    "Reducir extensión manteniendo intención estratégica.",
  more_punch:
    "Hacerlo más breve, más específico y con más filo editorial. Agregar tensión y punto de vista sin inflar el lenguaje, sin grandilocuencia, sin frases motivacionales y sin adjetivos decorativos. " +
    "«Más punch» es claridad y afilado, no más épica ni más marketing: acorta donde puedas, nombra el movimiento estratégico con precisión y evita vocabulario de brochure.",
  more_human:
    "Hacerlo más cercano, natural y humano.",
  more_elegant:
    "Hacerlo más sobrio, cuidado y memorable.",
};

/** Opciones rápidas para UI (valor API + etiqueta). */
export const REFINEMENT_QUICK_OPTIONS: ReadonlyArray<{
  preset: RefinementPreset;
  label: string;
}> = [
  { preset: "more_direct", label: "Más directo" },
  { preset: "more_emotional", label: "Más emocional" },
  { preset: "more_commercial", label: "Más comercial" },
  { preset: "more_provocative", label: "Más provocador" },
  { preset: "more_premium", label: "Más premium" },
  { preset: "clearer", label: "Más claro" },
  { preset: "less_institutional", label: "Menos institucional" },
  { preset: "shorter", label: "Más breve" },
  { preset: "more_punch", label: "Con más punch" },
  { preset: "more_human", label: "Más humano" },
  { preset: "more_elegant", label: "Más elegante" },
];

export function refinementPresetLabelEs(preset: RefinementPreset): string {
  return REFINEMENT_QUICK_OPTIONS.find((o) => o.preset === preset)?.label ?? preset;
}

const PRESET_KEY_SET = new Set<string>(
  REFINEMENT_QUICK_OPTIONS.map((o) => o.preset),
);

export function isRefinementPreset(v: string): v is RefinementPreset {
  return PRESET_KEY_SET.has(v);
}

export function readItemsCountFromGeneratedOutput(
  output: Record<string, unknown>,
): number {
  const raw = output.items;
  return Array.isArray(raw) ? raw.length : 0;
}

export type StoredStrategicFingerprint = {
  master_document_id: string;
  master_document_version: number;
  visible_framework_id: string;
  visible_framework_version: number;
};

/**
 * Lee la huella estratégica guardada al generar el contenido (request + columnas).
 */
export function readStoredStrategicFingerprint(
  row: {
    master_document_id: string | null;
    visible_framework_id: string | null;
  },
  request: Record<string, unknown>,
): StoredStrategicFingerprint | null {
  const mdIdRaw =
    (typeof row.master_document_id === "string" && row.master_document_id) ||
    request.master_document_id;
  const fwIdRaw =
    (typeof row.visible_framework_id === "string" && row.visible_framework_id) ||
    request.visible_framework_id;

  if (typeof mdIdRaw !== "string" || mdIdRaw.length === 0) return null;
  if (typeof fwIdRaw !== "string" || fwIdRaw.length === 0) return null;

  const mdVer = Number(request.master_document_version);
  const fwVer = Number(request.visible_framework_version);
  if (!Number.isInteger(mdVer) || mdVer < 0) return null;
  if (!Number.isInteger(fwVer) || fwVer < 0) return null;

  return {
    master_document_id: mdIdRaw,
    master_document_version: mdVer,
    visible_framework_id: fwIdRaw,
    visible_framework_version: fwVer,
  };
}

export type BuildContentRefinementStructuredParams =
  BuildContentGenerationInputParams & {
    sourceGeneratedContentId: string;
    sourceRequest: Record<string, unknown>;
    sourceOutput: Record<string, unknown>;
    refinementPreset: RefinementPreset | null;
    customRefinementNote: string | null;
  };

/**
 * Input alineado al de generación V1 (mismo bundle estratégico), con metadatos de refinamiento.
 */
export function buildContentRefinementStructuredInput(
  params: BuildContentRefinementStructuredParams,
): ContentGenerationStructuredInput {
  const {
    project,
    responses,
    masterDocument,
    visibleFramework,
    contentType,
    quantity,
    persistentEditorialGuidance,
  } = params;

  const { structured } = buildContentGenerationInput({
    project,
    responses,
    masterDocument,
    visibleFramework,
    contentType,
    quantity,
    userNote: null,
    persistentEditorialGuidance,
  });

  return {
    ...structured,
    prompt_version: CONTENT_REFINEMENT_PROMPT_VERSION,
    user_note: null,
    generation_instructions: {
      ...structured.generation_instructions,
      deliverable: `content_refinement_${params.contentType}`,
    },
  };
}

export function buildContentRefinementInputPayloadSummary(params: {
  hasSourceOutput: boolean;
  hasPersistentEditorialGuidance: boolean;
  hasApprovedFrameworkSnapshot: boolean;
}): Record<string, unknown> {
  return {
    refinement: true,
    has_source_output: params.hasSourceOutput,
    has_persistent_editorial_guidance: params.hasPersistentEditorialGuidance,
    has_approved_framework_snapshot: params.hasApprovedFrameworkSnapshot,
    has_limbi_creative_standard: true,
  };
}
