import { describe, expect, it } from "vitest";
import { brainstormerTurnIntentSchema } from "@/lib/brainstormer/conversation-contract";
import {
  BRAINSTORMER_TURN_JSON_SCHEMA_SESSION_PROGRESS_KEYS,
  BRAINSTORMER_TURN_JSON_SCHEMA_WORKING_BRIEF_KEYS,
  buildBrainstormerTurnJsonSchema,
} from "@/lib/openai/brainstormer-session";

function asObject(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  return value as Record<string, unknown>;
}

describe("buildBrainstormerTurnJsonSchema — OpenAI strict", () => {
  const schema = buildBrainstormerTurnJsonSchema();

  it("session_progress.required incluye working_brief y todas las properties", () => {
    const sessionProgress = asObject(asObject(schema.properties).session_progress);
    const required = sessionProgress.required as string[];
    const propertyKeys = Object.keys(asObject(sessionProgress.properties));

    expect(required).toContain("working_brief");
    expect(required.sort()).toEqual([...BRAINSTORMER_TURN_JSON_SCHEMA_SESSION_PROGRESS_KEYS].sort());
    expect(propertyKeys.sort()).toEqual(required.sort());
    expect(sessionProgress.additionalProperties).toBe(false);
  });

  it("working_brief.required incluye todas sus properties (memoria v3)", () => {
    const sessionProgress = asObject(asObject(schema.properties).session_progress);
    const workingBrief = asObject(asObject(sessionProgress.properties).working_brief);
    const required = workingBrief.required as string[];
    const propertyKeys = Object.keys(asObject(workingBrief.properties));

    expect(required).toContain("confirmed_decisions");
    expect(required).toContain("confirmed_conceptual_umbrella");
    expect(required).toContain("campaign_stage");
    expect(required).toContain("conversion_bridge");
    expect(required.sort()).toEqual([...BRAINSTORMER_TURN_JSON_SCHEMA_WORKING_BRIEF_KEYS].sort());
    expect(propertyKeys.sort()).toEqual(required.sort());
    expect(workingBrief.additionalProperties).toBe(false);
  });

  it("current_request_type enum alineado con brainstormerTurnIntentSchema", () => {
    const sessionProgress = asObject(asObject(schema.properties).session_progress);
    const workingBrief = asObject(asObject(sessionProgress.properties).working_brief);
    const currentRequestType = asObject(asObject(workingBrief.properties).current_request_type);
    expect(currentRequestType.enum).toEqual(brainstormerTurnIntentSchema.options);
  });

  it("raíz strict: required cubre properties", () => {
    const required = schema.required as string[];
    const propertyKeys = Object.keys(asObject(schema.properties));
    expect(required).toEqual(["assistant_message", "session_progress"]);
    expect(propertyKeys.sort()).toEqual(required.sort());
    expect(schema.additionalProperties).toBe(false);
  });
});
