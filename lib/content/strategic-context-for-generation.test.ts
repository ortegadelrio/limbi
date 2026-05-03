import { describe, expect, it } from "vitest";
import { resolveStrategicContextForGeneration } from "@/lib/content/strategic-context-for-generation";
import type { MasterDocumentProjectPayload } from "@/lib/master-document/build-input";

const baseProject: MasterDocumentProjectPayload = {
  id: "p1",
  user_id: "u1",
  name_or_descriptor: "Test",
  name_status: "confirmed",
  challenge_type: "brand",
  main_challenge: "Grow trust",
  status: "active",
};

describe("resolveStrategicContextForGeneration", () => {
  it("uses master slices when present and marks master_document", () => {
    const r = resolveStrategicContextForGeneration({
      project: baseProject,
      responses: {
        challenge_context: { challenge_explanation: "from wizard only" },
        strategic_base: { essence: "wizard strategic" },
        audience_base: { who: "wizard audience" },
      },
      masterDocument: {
        project_identity: { descriptor: "from master" },
        raw_inputs: {
          challenge_context: { challenge_explanation: "master challenge" },
        },
        strategic_base: { essence: "master strategic" },
        audience_base: { who: "master audience" },
      },
    });

    expect(r.generation_trace_source).toBe("master_document");
    expect(r.responses_fallback_fields).toEqual([]);
    expect(r.purpose_trace_for_generation.challenge_explanation).toBe(
      "master challenge",
    );
    expect(r.strategic_trace_for_generation.essence).toBe("master strategic");
    expect(r.audience_trace_for_generation.who).toBe("master audience");
    expect(r.project_identity_for_generation.descriptor).toBe("from master");
  });

  it("falls back per field when master slices are empty", () => {
    const r = resolveStrategicContextForGeneration({
      project: baseProject,
      responses: {
        challenge_context: { challenge_explanation: "fallback ch" },
        strategic_base: { essence: "fallback st" },
        audience_base: { who: "fallback aud" },
        project_identity: { extra: "gap" },
      },
      masterDocument: {
        project_identity: {},
        raw_inputs: {},
        strategic_base: {},
        audience_base: {},
      },
    });

    expect(r.generation_trace_source).toBe("responses_fallback");
    expect(r.responses_fallback_fields).toEqual(
      expect.arrayContaining([
        "project_identity",
        "wizard_purpose_trace.challenge_context",
        "wizard_purpose_trace.strategic_base",
        "wizard_purpose_trace.audience_base",
      ]),
    );
    expect(r.wizard_purpose_trace.challenge_context.challenge_explanation).toBe(
      "fallback ch",
    );
  });

  it("exposes response root keys without values in staleness trace", () => {
    const r = resolveStrategicContextForGeneration({
      project: baseProject,
      responses: { foo: 1, bar: { nested: true } },
      masterDocument: {
        project_identity: { id: "x" },
        raw_inputs: { challenge_context: { a: 1 } },
        strategic_base: { b: 2 },
        audience_base: { c: 3 },
      },
    });

    expect(r.project_responses_staleness_trace?.response_root_keys).toEqual([
      "bar",
      "foo",
    ]);
  });
});
