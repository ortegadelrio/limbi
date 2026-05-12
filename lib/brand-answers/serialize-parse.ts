import type {
  BrandAnswerValueJson,
  BrandResponseAnswerType,
  QuestionAnswerType,
  QuestionOption,
} from "@/types/database";

/** Valor en estado de formulario (por pregunta). */
export type BrandAnswerDraft =
  | { kind: "text"; text: string }
  | { kind: "single_choice"; value: string }
  | { kind: "multi_choice"; values: string[]; otherText?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function labelsForOptionValues(
  values: string[],
  options: QuestionOption[] | undefined,
): string | null {
  if (!options?.length || values.length === 0) return null;
  const parts = values.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const joined = parts.join(", ").trim();
  return joined.length > 0 ? joined : null;
}

export function defaultDraftForQuestion(def: {
  answer_type: string;
}): BrandAnswerDraft {
  if (def.answer_type === "single_choice") {
    return { kind: "single_choice", value: "" };
  }
  if (def.answer_type === "multi_choice") {
    return { kind: "multi_choice", values: [], otherText: "" };
  }
  return { kind: "text", text: "" };
}

/** Normaliza `answer_value` de DB a borrador editable. */
export function parseBrandAnswer(
  answerType: QuestionAnswerType | BrandResponseAnswerType,
  answerValue: unknown,
): BrandAnswerDraft {
  if (!isRecord(answerValue)) {
    if (answerType === "single_choice") {
      return { kind: "single_choice", value: "" };
    }
    if (answerType === "multi_choice") {
      return { kind: "multi_choice", values: [], otherText: "" };
    }
    return { kind: "text", text: "" };
  }

  switch (answerType) {
    case "single_choice": {
      const v = answerValue.value;
      return { kind: "single_choice", value: typeof v === "string" ? v : "" };
    }
    case "multi_choice": {
      const raw = answerValue.values;
      const values = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === "string")
        : [];
      const ot = answerValue.other_text;
      const otherText =
        typeof ot === "string" ? ot : "";
      return { kind: "multi_choice", values, otherText };
    }
    case "text":
    case "textarea":
    case "url": {
      const t = answerValue.text;
      return { kind: "text", text: typeof t === "string" ? t : "" };
    }
    default:
      return { kind: "text", text: "" };
  }
}

/** Construye `answer_value` + `answer_text` opcional para persistencia. */
export function serializeBrandAnswer(
  answerType: QuestionAnswerType | BrandResponseAnswerType,
  draft: BrandAnswerDraft,
  options?: QuestionOption[],
):
  | { answer_value: BrandAnswerValueJson; answer_text: string | null }
  | { error: string } {
  if (draft.kind === "single_choice") {
    if (answerType !== "single_choice") {
      return { error: "Inconsistencia entre borrador y tipo de pregunta." };
    }
    const answer_value: BrandAnswerValueJson = { value: draft.value };
    const label =
      draft.value.length > 0
        ? labelsForOptionValues([draft.value], options)
        : null;
    return {
      answer_value,
      answer_text: label ?? (draft.value.length > 0 ? draft.value : null),
    };
  }

  if (draft.kind === "multi_choice") {
    if (answerType !== "multi_choice") {
      return { error: "Inconsistencia entre borrador y tipo de pregunta." };
    }
    const hasOtherOption = options?.some((o) => o.value === "other") ?? false;
    const otherSelected = draft.values.includes("other");
    const trimmedOther = draft.otherText?.trim() ?? "";
    const includeOtherText =
      hasOtherOption && otherSelected && trimmedOther.length > 0;

    const answer_value: BrandAnswerValueJson = includeOtherText
      ? { values: draft.values, other_text: trimmedOther }
      : { values: draft.values };

    let answer_text = labelsForOptionValues(draft.values, options);
    if (includeOtherText) {
      const suffix = ` · Otro: ${trimmedOther}`;
      answer_text = answer_text ? `${answer_text}${suffix}` : `Otro: ${trimmedOther}`;
    }
    return {
      answer_value,
      answer_text,
    };
  }

  if (
    answerType === "text" ||
    answerType === "textarea" ||
    answerType === "url"
  ) {
    const answer_value: BrandAnswerValueJson = { text: draft.text };
    const trimmed = draft.text.trim();
    return {
      answer_value,
      answer_text: trimmed.length > 0 ? draft.text : null,
    };
  }

  return { error: "Este tipo de pregunta aún no tiene editor en la UI." };
}
