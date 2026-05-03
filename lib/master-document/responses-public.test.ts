import { describe, expect, it } from "vitest";
import { buildMasterDocumentInput } from "@/lib/master-document/build-input";
import { stripInternalResponseKeys } from "@/lib/master-document/responses-public";

describe("stripInternalResponseKeys", () => {
  it("removes underscore-prefixed keys", () => {
    const out = stripInternalResponseKeys({
      strategic_base: { simple_description: "x" },
      _limbic_interview_v1: { version: 1, turns: [] },
    });
    expect(out._limbic_interview_v1).toBeUndefined();
    expect((out.strategic_base as { simple_description: string }).simple_description).toBe(
      "x",
    );
  });
});

describe("buildMasterDocumentInput", () => {
  it("does not pass internal trace keys into raw_responses", () => {
    const input = buildMasterDocumentInput({
      project: {
        id: "p1",
        user_id: "u1",
        name_or_descriptor: "Test",
        name_status: "provisional",
        challenge_type: "brand",
        main_challenge: "explain_better",
        status: "draft",
      },
      responses: {
        strategic_base: { simple_description: "A" },
        _limbic_interview_v1: { pilot: "x", raw: "do not leak" },
      },
    });
    expect(input.raw_responses._limbic_interview_v1).toBeUndefined();
    expect(Object.keys(input.raw_responses).includes("_limbic_interview_v1")).toBe(
      false,
    );
  });
});
