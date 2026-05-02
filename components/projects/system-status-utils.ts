/**
 * Derivaciones de estado / siguiente acción para Sistema Límbico (solo UI).
 * No llama APIs; recibe flags ya resueltos en el cliente.
 */

export type SystemStepDisplayState =
  | "por_construir"
  | "activo"
  | "aprobado"
  | "necesita_actualizacion"
  | "listo";

export type SystemStepperStep = {
  id: "construction" | "lectura" | "marco" | "piezas";
  label: string;
  state: SystemStepDisplayState;
  locked: boolean;
};

export type NextActionVariant = "neutral" | "success" | "warning" | "active";

/** Claves para enlazar acciones en la vista detalle sin lógica duplicada. */
export type NextSystemActionKind =
  | "continue_wizard"
  | "generate_master"
  | "update_system"
  | "renew_reading_diagnosis"
  | "create_framework"
  | "update_framework"
  | "review_framework_draft"
  | "create_content"
  | "review_content";

export type NextSystemAction = {
  kind: NextSystemActionKind;
  variant: NextActionVariant;
  title: string;
  description: string;
  primaryLabel: string;
  /** Ruta interna si aplica; acciones POST se manejan en el padre por kind. */
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export type SystemStatusContext = {
  projectId: string;
  has_completed_wizard: boolean;
  hasActiveMaster: boolean;
  hasIqa: boolean;
  responsesChanged: boolean;
  frameworkOutdatedSinceMaster: boolean;
  hasAnyFramework: boolean;
  hasApprovedFramework: boolean;
  latestIsDraft: boolean;
  /** Marco coherente con lectura y respuestas (sin drift). */
  marcoAlineado: boolean;
  contentPiecesTotal: number;
};

export function sumGeneratedContentCounts(counts: {
  short_pitch: number;
  captions: number;
  content_ideas: number;
  graphic_phrases: number;
}): number {
  return (
    counts.short_pitch +
    counts.captions +
    counts.content_ideas +
    counts.graphic_phrases
  );
}

function stripState(
  ctx: SystemStatusContext,
): SystemStepDisplayState {
  if (!ctx.has_completed_wizard) return "por_construir";
  if (!ctx.hasActiveMaster) return "activo";
  if (ctx.responsesChanged) return "necesita_actualizacion";
  if (!ctx.hasIqa) return "necesita_actualizacion";
  return "listo";
}

function lecturaState(ctx: SystemStatusContext): SystemStepDisplayState {
  if (!ctx.hasActiveMaster) return "por_construir";
  if (ctx.responsesChanged) return "necesita_actualizacion";
  if (!ctx.hasIqa) return "necesita_actualizacion";
  return "listo";
}

function marcoState(ctx: SystemStatusContext): SystemStepDisplayState {
  if (!ctx.hasActiveMaster) return "por_construir";
  if (ctx.responsesChanged) return "necesita_actualizacion";
  if (!ctx.hasAnyFramework) return "por_construir";
  if (ctx.frameworkOutdatedSinceMaster) return "necesita_actualizacion";
  if (ctx.latestIsDraft) return "activo";
  if (ctx.hasApprovedFramework) return "aprobado";
  return "activo";
}

function piezasState(ctx: SystemStatusContext): SystemStepDisplayState {
  if (!ctx.hasApprovedFramework) return "por_construir";
  if (!ctx.marcoAlineado) return "necesita_actualizacion";
  if (ctx.contentPiecesTotal > 0) return "listo";
  return "activo";
}

export function deriveSystemStepperSteps(
  ctx: SystemStatusContext,
): SystemStepperStep[] {
  const s1 = stripState(ctx);
  const s2 = lecturaState(ctx);
  const s3 = marcoState(ctx);
  const s4 = piezasState(ctx);

  return [
    {
      id: "construction",
      label: "Construcción del sistema",
      state: s1,
      locked: false,
    },
    {
      id: "lectura",
      label: "Lectura Límbica",
      state: s2,
      locked: !ctx.has_completed_wizard,
    },
    {
      id: "marco",
      label: "Marco Estratégico Límbico",
      state: s3,
      locked: !ctx.hasActiveMaster,
    },
    {
      id: "piezas",
      label: "Piezas narrativas",
      state: s4,
      locked: !ctx.hasApprovedFramework,
    },
  ];
}

const WIZARD_HREF = (projectId: string) => `/projects/new?projectId=${projectId}`;
const FRAMEWORK_HREF = (projectId: string) => `/projects/${projectId}/framework`;
const CONTENT_HREF = (projectId: string) => `/projects/${projectId}/content`;

/**
 * Prioridad alineada con el producto: cuestionario → lectura → drift respuestas → marco desactualizado → borrador → crear marco → piezas.
 */
export function deriveNextSystemAction(ctx: SystemStatusContext): NextSystemAction {
  const { projectId } = ctx;

  if (!ctx.has_completed_wizard) {
    return {
      kind: "continue_wizard",
      variant: "active",
      title: "Completa la construcción del sistema",
      description:
        "Termina de alimentar la memoria narrativa para que Limbi pueda generar la Lectura Límbica.",
      primaryLabel: "Continuar construcción",
      primaryHref: WIZARD_HREF(projectId),
    };
  }

  if (!ctx.hasActiveMaster) {
    return {
      kind: "generate_master",
      variant: "active",
      title: "Genera la Lectura Límbica",
      description:
        "La construcción del sistema está lista; falta activar la lectura del documento maestro para diagnosticar calidad y continuar.",
      primaryLabel: "Generar Lectura Límbica",
    };
  }

  if (ctx.responsesChanged) {
    return {
      kind: "update_system",
      variant: "warning",
      title: "El sistema recibió nueva información",
      description:
        "Actualiza la Lectura Límbica antes de crear un nuevo Marco.",
      primaryLabel: "Actualizar Sistema Límbico",
      secondaryLabel: "Editar respuestas",
      secondaryHref: WIZARD_HREF(projectId),
    };
  }

  /** Lectura activa sin IQA (legacy): misma acción técnica que regenerar maestro, sin copiar “Actualizar Sistema Límbico”. */
  if (!ctx.hasIqa) {
    return {
      kind: "renew_reading_diagnosis",
      variant: "warning",
      title: "Completa el diagnóstico de la Lectura Límbica",
      description:
        "Esta lectura se generó con una versión anterior del diagnóstico. Renueva la Lectura para ver preparación, riesgos y acciones por sección.",
      primaryLabel: "Renovar Lectura Límbica",
      secondaryLabel: "Editar respuestas",
      secondaryHref: WIZARD_HREF(projectId),
    };
  }

  if (ctx.frameworkOutdatedSinceMaster && ctx.hasAnyFramework) {
    return {
      kind: "update_framework",
      variant: "warning",
      title: "El Marco necesita actualización",
      description:
        "Este Marco fue creado con una lectura anterior del sistema. Actualízalo para alinearlo con la memoria vigente.",
      primaryLabel: "Actualizar Marco Estratégico Límbico",
      secondaryLabel: "Ver Marco",
      secondaryHref: FRAMEWORK_HREF(projectId),
    };
  }

  if (ctx.latestIsDraft && ctx.hasAnyFramework) {
    return {
      kind: "review_framework_draft",
      variant: "neutral",
      title: "Revisa el Marco Estratégico Límbico",
      description:
        "Ya existe un borrador del Marco. Revísalo, ajusta lo necesario y apruébalo cuando esté listo.",
      primaryLabel: "Revisar Marco Estratégico Límbico",
      primaryHref: FRAMEWORK_HREF(projectId),
    };
  }

  if (!ctx.hasAnyFramework) {
    return {
      kind: "create_framework",
      variant: "active",
      title: "Crea el Marco Estratégico Límbico",
      description:
        "Con la Lectura Límbica al día, puedes generar el borrador del Marco como base estratégica.",
      primaryLabel: "Crear Marco Estratégico Límbico",
      secondaryLabel: "Editar respuestas",
      secondaryHref: WIZARD_HREF(projectId),
    };
  }

  if (ctx.hasApprovedFramework && ctx.marcoAlineado) {
    if (ctx.contentPiecesTotal > 0) {
      return {
        kind: "review_content",
        variant: "success",
        title: "Revisar piezas narrativas",
        description:
          "Ya tienes piezas creadas. Puedes revisarlas, refinarlas o crear nuevas versiones.",
        primaryLabel: "Ver piezas narrativas",
        primaryHref: CONTENT_HREF(projectId),
        secondaryLabel: "Ver Marco aprobado",
        secondaryHref: FRAMEWORK_HREF(projectId),
      };
    }
    return {
      kind: "create_content",
      variant: "success",
      title: "Sistema listo para crear piezas",
      description:
        "Ya puedes crear piezas narrativas desde el Marco Estratégico Límbico aprobado.",
      primaryLabel: "Crear piezas narrativas",
      primaryHref: CONTENT_HREF(projectId),
      secondaryLabel: "Ver Marco aprobado",
      secondaryHref: FRAMEWORK_HREF(projectId),
    };
  }

  return {
    kind: "review_framework_draft",
    variant: "neutral",
    title: "Continúa con el Marco Límbico",
    description:
        "Revisa el estado del Marco en la siguiente etapa y alinéalo con la Lectura Límbica cuando haga falta.",
    primaryLabel: "Abrir Marco",
    primaryHref: FRAMEWORK_HREF(projectId),
  };
}

export type SystemHealthStripModel = {
  lecturaLine: string;
  marcoLine: string;
  piezasLine: string;
  estadoLine: string;
};

export function deriveSystemHealthStrip(
  ctx: SystemStatusContext,
): SystemHealthStripModel {
  let lecturaLine = "Lectura Límbica: —";
  if (!ctx.has_completed_wizard) {
    lecturaLine = "Lectura Límbica: bloqueada";
  } else if (!ctx.hasActiveMaster) {
    lecturaLine = "Lectura Límbica: pendiente";
  } else if (ctx.responsesChanged || !ctx.hasIqa) {
    lecturaLine = "Lectura Límbica: necesita actualización";
  } else {
    lecturaLine = "Lectura Límbica: activa";
  }

  let marcoLine = "Marco: —";
  if (!ctx.hasActiveMaster) {
    marcoLine = "Marco: bloqueado";
  } else if (!ctx.hasAnyFramework) {
    marcoLine = "Marco: pendiente";
  } else if (ctx.frameworkOutdatedSinceMaster) {
    marcoLine = "Marco: desactualizado";
  } else if (ctx.latestIsDraft) {
    marcoLine = "Marco: borrador";
  } else if (ctx.hasApprovedFramework) {
    marcoLine = "Marco: aprobado";
  } else {
    marcoLine = "Marco: en curso";
  }

  const piezasLine =
    ctx.contentPiecesTotal > 0
      ? `Piezas: ${String(ctx.contentPiecesTotal)} generaciones`
      : "Piezas: sin generaciones";

  let estadoLine = "Estado: en curso";
  if (!ctx.has_completed_wizard) {
    estadoLine = "Estado: por construir";
  } else if (ctx.hasApprovedFramework && ctx.marcoAlineado) {
    estadoLine =
      ctx.contentPiecesTotal > 0 ? "Estado: listo" : "Estado: listo para piezas";
  } else if (ctx.responsesChanged || ctx.frameworkOutdatedSinceMaster) {
    estadoLine = "Estado: necesita actualización";
  }

  return { lecturaLine, marcoLine, piezasLine, estadoLine };
}

/** Etiqueta corta para chip en listado (prioriza urgencia). */
export type ListUrgencyChip =
  | "necesita_actualizacion"
  | "listo_piezas"
  | "marco_borrador"
  | "por_construir"
  | null;

export type ProjectListStatusSnapshot = {
  has_completed_wizard: boolean;
  active_master_document: unknown | null;
  input_quality_assessment: unknown | null;
  responses_have_changed_since_master?: boolean;
  framework_is_outdated_since_master?: boolean;
  latest_visible_framework: { status: string } | null;
  approved_visible_framework: unknown | null;
  generated_content_counts: {
    short_pitch: number;
    captions: number;
    content_ideas: number;
    graphic_phrases: number;
  };
};

export function buildListContext(
  projectId: string,
  projectStatus: string,
  snapshot: ProjectListStatusSnapshot | null,
): SystemStatusContext {
  const has_completed_wizard = snapshot?.has_completed_wizard ?? false;
  const hasActiveMaster = snapshot?.active_master_document != null;
  const hasIqa =
    snapshot?.input_quality_assessment != null &&
    typeof snapshot.input_quality_assessment === "object";
  const responsesChanged =
    snapshot?.responses_have_changed_since_master === true;
  const frameworkOutdatedSinceMaster =
    snapshot?.framework_is_outdated_since_master === true;
  const latest = snapshot?.latest_visible_framework ?? null;
  const hasAnyFramework = latest !== null;
  const approved = snapshot?.approved_visible_framework;
  const hasApprovedFramework = approved != null;
  const latestIsDraft = latest?.status === "draft";
  const marcoAlineado =
    hasAnyFramework && !responsesChanged && !frameworkOutdatedSinceMaster;
  const counts = snapshot?.generated_content_counts ?? {
    short_pitch: 0,
    captions: 0,
    content_ideas: 0,
    graphic_phrases: 0,
  };
  const contentPiecesTotal = sumGeneratedContentCounts(counts);

  if (!snapshot) {
    const inferredWizard =
      projectStatus !== "draft" &&
      (projectStatus === "responses_completed" ||
        projectStatus === "master_created" ||
        projectStatus === "framework_created" ||
        projectStatus === "framework_approved");
    const inferredMaster =
      projectStatus === "master_created" ||
      projectStatus === "framework_created" ||
      projectStatus === "framework_approved";
    const inferredFramework = projectStatus === "framework_created" ||
      projectStatus === "framework_approved";
    const inferredApproved = projectStatus === "framework_approved";

    return {
      projectId,
      has_completed_wizard: inferredWizard,
      hasActiveMaster: inferredMaster,
      hasIqa: inferredMaster,
      responsesChanged: false,
      frameworkOutdatedSinceMaster: false,
      hasAnyFramework: inferredFramework,
      hasApprovedFramework: inferredApproved,
      latestIsDraft: projectStatus === "framework_created",
      marcoAlineado: inferredFramework && inferredApproved,
      contentPiecesTotal: 0,
    };
  }

  return {
    projectId,
    has_completed_wizard,
    hasActiveMaster,
    hasIqa,
    responsesChanged,
    frameworkOutdatedSinceMaster,
    hasAnyFramework,
    hasApprovedFramework,
    latestIsDraft,
    marcoAlineado,
    contentPiecesTotal,
  };
}

export function deriveListUrgencyChip(
  ctx: SystemStatusContext,
): ListUrgencyChip {
  if (!ctx.has_completed_wizard) return "por_construir";
  if (ctx.responsesChanged || ctx.frameworkOutdatedSinceMaster) {
    return "necesita_actualizacion";
  }
  if (ctx.hasApprovedFramework && ctx.marcoAlineado) {
    return "listo_piezas";
  }
  if (ctx.latestIsDraft && ctx.hasAnyFramework) return "marco_borrador";
  return null;
}

export function listChipLabel(chip: ListUrgencyChip): string | null {
  if (!chip) return null;
  const labels: Record<NonNullable<ListUrgencyChip>, string> = {
    necesita_actualizacion: "Necesita actualización",
    listo_piezas: "Listo para crear piezas",
    marco_borrador: "Marco en borrador",
    por_construir: "Por construir",
  };
  return labels[chip];
}

/** Una línea para “Siguiente acción” en tarjeta de listado. */
export function deriveListNextActionSummary(ctx: SystemStatusContext): string {
  return deriveNextSystemAction(ctx).title;
}
