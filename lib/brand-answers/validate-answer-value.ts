import { z } from "zod";
import type { BrandResponseAnswerType } from "@/types/database";

const textLikeSchema = z.object({ text: z.string() });
const singleChoiceSchema = z.object({ value: z.string() });
const multiChoiceSchema = z.object({ values: z.array(z.string()) });
const numericValueSchema = z.object({ value: z.number() });
const booleanValueSchema = z.object({ value: z.boolean() });

export type ValidatedBrandAnswerValue =
  | z.infer<typeof textLikeSchema>
  | z.infer<typeof singleChoiceSchema>
  | z.infer<typeof multiChoiceSchema>
  | z.infer<typeof numericValueSchema>
  | z.infer<typeof booleanValueSchema>;

export function validateAnswerValueForType(
  raw: unknown,
  answerType: BrandResponseAnswerType,
): { ok: true; value: ValidatedBrandAnswerValue } | { ok: false; message: string } {
  try {
    switch (answerType) {
      case "text":
      case "textarea":
      case "url": {
        const v = textLikeSchema.parse(raw);
        return { ok: true, value: v };
      }
      case "single_choice": {
        const v = singleChoiceSchema.parse(raw);
        return { ok: true, value: v };
      }
      case "multi_choice": {
        const v = multiChoiceSchema.parse(raw);
        return { ok: true, value: v };
      }
      case "scale":
      case "number": {
        const v = numericValueSchema.parse(raw);
        return { ok: true, value: v };
      }
      case "boolean": {
        const v = booleanValueSchema.parse(raw);
        return { ok: true, value: v };
      }
      default: {
        const _never: never = answerType;
        return { ok: false, message: `Tipo de respuesta no soportado: ${_never}` };
      }
    }
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.message : "Valor de respuesta inválido.";
    return { ok: false, message: msg };
  }
}
