import { mergeClarificationSuggestionChips } from "@/lib/questionnaire-evaluation/clarification-ui-suggestions";
import { clipClarificationQuestionsToScoreCap } from "@/lib/questionnaire-evaluation/clarification-round-cap";
import type {
  ClarificationQuestion,
  QuestionnaireEvaluationPayload,
} from "@/lib/questionnaire-evaluation/schema";
import { questionnaireEvaluationPayloadSchema } from "@/lib/questionnaire-evaluation/schema";
import {
  WIZARD_LABEL_KEYS_SORTED,
  WIZARD_VALUE_TO_LABEL,
} from "@/lib/questionnaire-evaluation/wizard-value-labels";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sustituye slugs/valores internos del cuestionario por etiquetas en español y suaviza snake_case residual.
 */
export function humanizeWizardTokensInText(text: string): string {
  let t = text.trim();
  if (!t) return t;
  const compactKey = t.replace(/\s+/g, "_").toLowerCase();
  if (WIZARD_VALUE_TO_LABEL[t]) return WIZARD_VALUE_TO_LABEL[t];
  if (WIZARD_VALUE_TO_LABEL[compactKey]) return WIZARD_VALUE_TO_LABEL[compactKey];

  for (const key of WIZARD_LABEL_KEYS_SORTED) {
    const re = new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi");
    if (re.test(t)) {
      const label = WIZARD_VALUE_TO_LABEL[key];
      if (label) t = t.replace(re, label);
    }
  }

  t = t.replace(/\b([a-z]{2,})(_[a-z0-9]+)+\b/gi, (m) => {
    const low = m.toLowerCase();
    if (WIZARD_VALUE_TO_LABEL[low]) return WIZARD_VALUE_TO_LABEL[low] ?? m;
    return m.replace(/_/g, " ");
  });

  return t.replace(/\s+/g, " ").trim();
}

/**
 * Texto normalizado (sin acentos, minúsculas) para comprobar si un término aparece en el contexto del usuario.
 */
export function buildQuestionnaireContextFold(
  responses: Record<string, unknown>,
): string {
  const chunks: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") chunks.push(v);
    else if (typeof v === "number" || typeof v === "boolean")
      chunks.push(String(v));
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    }
  };
  walk(responses);
  let raw = `${fold(chunks.join(" "))} ${fold(JSON.stringify(responses))}`;
  for (const [slug, label] of Object.entries(WIZARD_VALUE_TO_LABEL)) {
    raw += ` ${fold(slug)} ${fold(label)}`;
  }
  return raw.replace(/\s+/g, " ").trim();
}

/** Si el texto del modelo cita audiencias/sectores que no aparecen en el cuestionario, se descarta. */
const ENTITY_GATES: { pattern: RegExp; blob: RegExp }[] = [
  {
    pattern: /\bemprendedores?\b/i,
    blob: /\b(emprendedores?|entrepreneur|project_venture|emprendimiento|startup|scale-?up)\b/i,
  },
  {
    pattern: /\b(b2b|business\s+to\s+business)\b/i,
    blob: /\bb2b\b|business[-\s]?to[-\s]?business|empresas\s*\/\s*clientes/i,
  },
  {
    pattern: /\bcorporativ(a|o|as|os)?\b/i,
    blob: /\bcorporat|enterprise|multinacion|comunicaci(ón|on)\s+corporativ/i,
  },
  {
    pattern: /\b(inversores?|venture\s*capital|unicornio)\b/i,
    blob: /\b(inversor|vc|venture|capital\s*riesgo|unicornio)\b/i,
  },
  {
    pattern: /\bestudiantes?\b/i,
    blob: /\b(estudiante|alumno|universidad|escuela|formaci(ón|on))\b/i,
  },
];

function combinedQuestionSurface(q: ClarificationQuestion): string {
  const parts = [
    q.limbi_detection ?? "",
    q.referenced_user_answer,
    q.why_it_matters,
    q.question_text,
    ...(q.options?.map((o) => `${o.id} ${o.label}`) ?? []),
  ];
  return parts.join("\n");
}

function passesEntityGates(surface: string, blobFolded: string): boolean {
  const fSurf = fold(surface);
  for (const { pattern, blob: blobMust } of ENTITY_GATES) {
    if (pattern.test(fSurf) && !blobMust.test(blobFolded)) return false;
  }
  return true;
}

/** Plantillas genéricas poco útiles que pedimos sustituir por versiones ancladas al proyecto. */
function isGenericEvidenceQuestion(questionText: string): boolean {
  const f = fold(questionText);
  if (
    f.includes("casos de estudio") &&
    (f.includes("exito pasado") ||
      f.includes("éxito pasado") ||
      f.includes("exito"))
  ) {
    return true;
  }
  if (
    f.includes("ejemplo") &&
    f.includes("exito") &&
    (f.includes("pasado") || f.includes("caso"))
  ) {
    return true;
  }
  return false;
}

/**
 * Humaniza citas, filtra preguntas fuera de contexto y elimina plantillas de evidencia genéricas.
 */
export function sanitizeClarificationQuestionsForEvaluation(
  questions: ClarificationQuestion[],
  responses: Record<string, unknown>,
): ClarificationQuestion[] {
  const blob = buildQuestionnaireContextFold(responses);
  const out: ClarificationQuestion[] = [];

  for (const q of questions) {
    const ref = humanizeWizardTokensInText(q.referenced_user_answer);
    const why = humanizeWizardTokensInText(q.why_it_matters);
    const qt = humanizeWizardTokensInText(q.question_text);
    const detRaw = q.limbi_detection?.trim();
    const det =
      detRaw && detRaw.length > 0
        ? humanizeWizardTokensInText(detRaw)
        : `Limbi detectó un matiz poco claro en lo que compartiste (antes aparecía como dato técnico del cuestionario).`;

    const humanized: ClarificationQuestion = {
      ...q,
      limbi_detection: det,
      referenced_user_answer:
        ref.length > 0
          ? ref
          : "Tradujimos una respuesta del cuestionario que estaba solo en formato interno.",
      why_it_matters: why,
      question_text: qt,
      options: q.options?.map((o) => ({
        ...o,
        label: humanizeWizardTokensInText(o.label),
      })),
    };

    if (!passesEntityGates(combinedQuestionSurface(humanized), blob)) continue;
    if (isGenericEvidenceQuestion(humanized.question_text)) continue;

    out.push(humanized);
  }

  return out;
}

/**
 * Si no queda ninguna pregunta tras filtrar, devuelve una pregunta segura anclada al texto ya enviado.
 */
export function ensureClarificationQuestionsMinimum(
  questions: ClarificationQuestion[],
  responses: Record<string, unknown>,
): ClarificationQuestion[] {
  if (questions.length > 0) return questions;

  const sb =
    responses.strategic_base && typeof responses.strategic_base === "object"
      ? (responses.strategic_base as Record<string, unknown>)
      : {};
  const cc =
    responses.challenge_context && typeof responses.challenge_context === "object"
      ? (responses.challenge_context as Record<string, unknown>)
      : {};
  const ab =
    responses.audience_base && typeof responses.audience_base === "object"
      ? (responses.audience_base as Record<string, unknown>)
      : {};

  const anchor = [
    typeof sb.simple_description === "string" ? sb.simple_description : "",
    typeof cc.challenge_explanation === "string" ? cc.challenge_explanation : "",
    typeof ab.audience_description_optional === "string"
      ? ab.audience_description_optional
      : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" • ")
    .slice(0, 380);

  return [
    {
      id: "limbi_safe_context_anchor",
      limbi_detection:
        "Limbi ajustó las preguntas automáticas para que no inventen audiencias ni sectores ajenos a tu caso.",
      referenced_user_answer:
        anchor ||
        "Lo que ya compartiste sobre el proyecto, el reto y la audiencia es la base que estamos usando.",
      why_it_matters:
        "Una precisión final evita que la Lectura Límbica se apoye en suposiciones genéricas.",
      question_text:
        "¿Qué matizarías sobre tu propuesta, la audiencia que priorizas o la evidencia que sí puedes usar hoy (sin inventar cifras) antes de generar la Lectura Límbica?",
      allow_free_text: true,
    },
  ];
}

/**
 * Sanitiza preguntas de aclaración y garantiza al menos una pregunta segura si el filtro las vacía.
 */
export function finalizeEvaluationPayload(
  data: QuestionnaireEvaluationPayload,
  responses: Record<string, unknown>,
): QuestionnaireEvaluationPayload {
  const cleaned = sanitizeClarificationQuestionsForEvaluation(
    data.clarification_questions,
    responses,
  );
  const withMinimum = ensureClarificationQuestionsMinimum(cleaned, responses);
  const capped = clipClarificationQuestionsToScoreCap(
    withMinimum,
    data.overall_quality_score,
  );
  const withSanitizedChips = capped.map((q) =>
    mergeClarificationSuggestionChips(q, responses),
  );
  const merged = { ...data, clarification_questions: withSanitizedChips };
  const again = questionnaireEvaluationPayloadSchema.safeParse(merged);
  return again.success ? again.data : merged;
}
