import { brainstormerTurnIntentSchema } from "@/lib/brainstormer/conversation-contract";
import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAINSTORMER_SESSION_MODEL = "gpt-4o-mini";

const TURN_INTENT_ENUM = brainstormerTurnIntentSchema.options;

const WORKING_BRIEF_PROPERTY_KEYS = [
  "contract_version",
  "strategic_moment",
  "current_request_type",
  "active_constraints",
  "user_corrections",
  "rejected_paths",
  "approved_signals",
  "open_decisions",
  "next_best_step",
  "confirmed_decisions",
  "confirmed_conceptual_umbrella",
  "campaign_stage",
  "conversion_bridge",
] as const;

const SESSION_PROGRESS_PROPERTY_KEYS = [
  "session_summary",
  "current_challenge",
  "preliminary_objective",
  "audience_notes",
  "tension_or_pain",
  "opportunities",
  "ideas_explored",
  "recommended_routes",
  "open_questions",
  "next_step",
  "project_readiness",
  "suggested_project_type",
  "should_suggest_project_conversion",
  "project_seed_summary",
  "missing_project_inputs",
  "working_brief",
] as const;

/** JSON Schema OpenAI strict — exportado para tests de contrato. */
export function buildBrainstormerTurnJsonSchema(): Record<string, unknown> {
  const s = { type: "string", maxLength: 8000 } as const;
  const seed = { type: "string", maxLength: 4000 } as const;

  const working_brief_properties = {
    contract_version: { type: "string", enum: ["v3"] },
    strategic_moment: {
      type: "string",
      enum: [
        "unknown",
        "launch",
        "relaunch",
        "repositioning",
        "positioning_reinforcement",
        "conversion",
        "maintenance",
        "activation",
        "recall",
      ],
    },
    current_request_type: {
      type: "string",
      enum: [...TURN_INTENT_ENUM],
    },
    active_constraints: {
      type: "array",
      maxItems: 32,
      items: { type: "string", maxLength: 400 },
    },
    user_corrections: {
      type: "array",
      maxItems: 24,
      items: { type: "string", maxLength: 600 },
    },
    rejected_paths: {
      type: "array",
      maxItems: 20,
      items: { type: "string", maxLength: 600 },
    },
    approved_signals: {
      type: "array",
      maxItems: 20,
      items: { type: "string", maxLength: 600 },
    },
    open_decisions: {
      type: "array",
      maxItems: 16,
      items: { type: "string", maxLength: 600 },
    },
    next_best_step: { type: "string", maxLength: 1200 },
    confirmed_decisions: {
      type: "array",
      maxItems: 16,
      items: { type: "string", maxLength: 400 },
    },
    confirmed_conceptual_umbrella: { type: "string", maxLength: 600 },
    campaign_stage: {
      type: "string",
      enum: [
        "unknown",
        "expectativa",
        "prelanzamiento",
        "lanzamiento",
        "conversion",
        "sostenimiento",
      ],
    },
    conversion_bridge: { type: "string", maxLength: 800 },
  } satisfies Record<string, unknown>;

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      assistant_message: { type: "string", minLength: 1, maxLength: 16000 },
      session_progress: {
        type: "object",
        additionalProperties: false,
        properties: {
          session_summary: s,
          current_challenge: s,
          preliminary_objective: s,
          audience_notes: s,
          tension_or_pain: s,
          opportunities: s,
          ideas_explored: s,
          recommended_routes: s,
          open_questions: s,
          next_step: s,
          project_readiness: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          suggested_project_type: {
            type: "string",
            enum: [
              "campaign_360",
              "content_generation",
              "brand_activation",
              "audiovisual",
              "event_promotion",
              "other",
            ],
          },
          should_suggest_project_conversion: { type: "boolean" },
          project_seed_summary: seed,
          missing_project_inputs: {
            type: "array",
            maxItems: 24,
            items: { type: "string", maxLength: 500 },
          },
          working_brief: {
            type: "object",
            additionalProperties: false,
            properties: working_brief_properties,
            required: [...WORKING_BRIEF_PROPERTY_KEYS],
          },
        },
        required: [...SESSION_PROGRESS_PROPERTY_KEYS],
      },
    },
    required: ["assistant_message", "session_progress"],
  };
}

export async function generateBrainstormerTurnJson(args: {
  input: string;
}): Promise<BrainstormerSessionJsonResult> {
  const openai = getOpenAIClient();
  const model = resolveBrainstormerSessionModel();
  const schema = buildBrainstormerTurnJsonSchema();

  const response = await openai.responses.create({
    model,
    input: args.input,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "brainstormer_session_turn",
        strict: true,
        schema,
      },
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI devolvió un error en la respuesta.");
  }

  if (response.status && response.status !== "completed") {
    const reason = response.incomplete_details?.reason ?? response.status;
    throw new Error(`La respuesta de OpenAI no está completa (estado: ${String(reason)}).`);
  }

  const raw_json_text = response.output_text?.trim() ?? "";
  if (!raw_json_text) {
    throw new Error("OpenAI no devolvió texto JSON en output_text.");
  }

  return { model_used: String(response.model ?? model), raw_json_text };
}

export function resolveBrainstormerSessionModel(): string {
  const fromEnv = process.env.OPENAI_BRAINSTORMER_SESSION_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAINSTORMER_SESSION_MODEL;
}

export type BrainstormerSessionJsonResult = {
  model_used: string;
  raw_json_text: string;
};

export type BrainstormerOutputRepairArgs = {
  original_assistant_message: string;
  repair_instruction: string;
  last_user_message: string;
  working_brief_block: string;
  thinking_model_block: string;
};

/** Segunda pasada corta: solo reescribe el texto visible al usuario. */
export async function generateBrainstormerOutputRepair(
  args: BrainstormerOutputRepairArgs,
): Promise<string> {
  const openai = getOpenAIClient();
  const model = resolveBrainstormerSessionModel();

  const input = [
    "REPAIR — SUSTITUYE la respuesta deficiente por una respuesta nueva completa (español, 80–130 palabras).",
    "No edites ni «mejores» el texto original: REEMPLÁZALO por uno nuevo que cumpla la instrucción.",
    "Sin JSON, sin encabezados Lectura/Criterio/Ruta, sin etiquetas de modelo.",
    "",
    `ÚLTIMO MENSAJE USUARIO: ${args.last_user_message}`,
    "",
    args.working_brief_block,
    "",
    args.thinking_model_block,
    "",
    "RESPUESTA ANTERIOR (descartar — no reutilizar frases ni estructura):",
    args.original_assistant_message,
    "",
    "INSTRUCCIÓN DE REPARACIÓN (obligatoria):",
    args.repair_instruction,
    "",
    "Devuelve SOLO el texto nuevo que reemplaza la respuesta anterior.",
  ].join("\n");

  const response = await openai.responses.create({
    model,
    input,
    stream: false,
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI devolvió un error en la reparación.");
  }

  const text = response.output_text?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI no devolvió texto en la reparación.");
  }
  return text;
}

/** Claves exportadas para tests de alineación strict / Zod. */
export const BRAINSTORMER_TURN_JSON_SCHEMA_WORKING_BRIEF_KEYS = WORKING_BRIEF_PROPERTY_KEYS;
export const BRAINSTORMER_TURN_JSON_SCHEMA_SESSION_PROGRESS_KEYS = SESSION_PROGRESS_PROPERTY_KEYS;
