import { getOpenAIClient } from "@/lib/openai/server";

export const FALLBACK_BRAINSTORMER_SESSION_MODEL = "gpt-4o-mini";

export function resolveBrainstormerSessionModel(): string {
  const fromEnv = process.env.OPENAI_BRAINSTORMER_SESSION_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_BRAINSTORMER_SESSION_MODEL;
}

export type BrainstormerSessionJsonResult = {
  model_used: string;
  raw_json_text: string;
};

function buildBrainstormerTurnJsonSchema(): Record<string, unknown> {
  const s = { type: "string", maxLength: 8000 } as const;
  const seed = { type: "string", maxLength: 4000 } as const;
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
        },
        required: [
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
        ],
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
