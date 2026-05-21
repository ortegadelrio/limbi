import type { BrainstormerWorkingBrief } from "@/lib/brainstormer/conversation-contract";
import { brainstormerTurnInterpretationSchema } from "@/lib/brainstormer/interpret-brainstormer-turn";
import {
  conversationActSchema,
  interpretedStrategyStageSchema,
  responseModeSchema,
} from "@/lib/brainstormer/turn-interpreter";
import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAINSTORMER_TURN_INTERPRET_MODEL = "gpt-4o-mini";

function resolveBrainstormerTurnInterpretModel(): string {
  const fromEnv = process.env.OPENAI_BRAINSTORMER_TURN_INTERPRET_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAINSTORMER_TURN_INTERPRET_MODEL;
}

function buildInterpretJsonSchema(): Record<string, unknown> {
  const actEnum = conversationActSchema.options;
  const modeEnum = responseModeSchema.options;
  const stageEnum = interpretedStrategyStageSchema.options;

  return {
    type: "object",
    additionalProperties: false,
    required: ["conversation_act", "response_mode", "memory_update", "strategy_stage"],
    properties: {
      conversation_act: { type: "string", enum: [...actEnum] },
      response_mode: { type: "string", enum: [...modeEnum] },
      memory_update: {
        type: "object",
        additionalProperties: false,
        required: [
          "update_umbrella",
          "umbrella_candidate",
          "reject_current_concept",
          "clear_umbrella",
        ],
        properties: {
          update_umbrella: { type: "boolean" },
          umbrella_candidate: { type: ["string", "null"], maxLength: 200 },
          reject_current_concept: { type: "boolean" },
          clear_umbrella: { type: "boolean" },
        },
      },
      strategy_stage: { type: "string", enum: [...stageEnum] },
    },
  };
}

export type GenerateBrainstormerTurnInterpretationArgs = {
  last_user_message: string;
  conversation_excerpt: string;
  working_brief: BrainstormerWorkingBrief;
  brand_name: string;
};

export async function generateBrainstormerTurnInterpretationJson(
  args: GenerateBrainstormerTurnInterpretationArgs,
): Promise<{ model_used: string; raw_json_text: string }> {
  const openai = getOpenAIClient();
  const model = resolveBrainstormerTurnInterpretModel();
  const umbrella = args.working_brief.confirmed_conceptual_umbrella.trim();

  const input = [
    "Clasifica el último mensaje del usuario en una sesión de estrategia creativa.",
    "Devuelve SOLO JSON según el schema. No generes copy ni frases para el usuario.",
    "memory_update.update_umbrella=true solo con propuesta/confirmación explícita de concepto corto entre comillas.",
    "Mensajes de estado de proyecto (sitio listo, falta campaña) NO son paraguas.",
    "Rechazo o pedido de alternativas: reject_current_concept=true, update_umbrella=false.",
    `Marca: ${args.brand_name || "—"}`,
    `Paraguas confirmado: ${umbrella || "ninguno"}`,
    `strategy_stage actual: ${args.working_brief.strategy_stage}`,
    "",
    "Último mensaje:",
    args.last_user_message.trim(),
    "",
    "Excerpt reciente:",
    args.conversation_excerpt.trim().slice(-4000),
  ].join("\n");

  const response = await openai.responses.create({
    model,
    input,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "brainstormer_turn_interpretation",
        strict: true,
        schema: buildInterpretJsonSchema(),
      },
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI error en interpretación de turno.");
  }

  const raw_json_text = response.output_text?.trim() ?? "";
  if (!raw_json_text) {
    throw new Error("OpenAI no devolvió JSON de interpretación.");
  }

  const parsed = brainstormerTurnInterpretationSchema.safeParse(JSON.parse(raw_json_text));
  if (!parsed.success) {
    throw new Error(`JSON de interpretación inválido: ${parsed.error.message}`);
  }

  return { model_used: String(response.model ?? model), raw_json_text };
}
