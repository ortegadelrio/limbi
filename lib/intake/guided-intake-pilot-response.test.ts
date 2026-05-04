import { describe, expect, it } from "vitest";
import { initialTrace } from "@/lib/intake/orchestrator";
import { parseIntakeTurnResponseOrThrow } from "@/lib/intake/guided-intake-pilot-response";

const minimalExtraction = {
  extracted_response_updates: {},
  confidence_by_field: {},
  needs_follow_up: false,
  follow_up_question: null,
  suggested_answer_chips: [],
  answer_status: "clear" as const,
  target_response_paths: [] as string[],
  internal_notes: "",
  interviewer_message: "ok",
  public_copy_allowed: false,
  user_intent: "answer" as const,
};

describe("parseIntakeTurnResponseOrThrow", () => {
  it("accepts a well-formed intake-turn payload", () => {
    const json = {
      extraction: minimalExtraction,
      trace: { ...initialTrace(), mini_step: "audience" as const },
      follow_up_question: null,
      suggested_chips: ["a", "b"],
      summary: null,
      interviewer_message: "Hola",
      next_question: null,
      project_challenge_type: "service",
    };
    const r = parseIntakeTurnResponseOrThrow(json);
    expect(r.trace.mini_step).toBe("audience");
    expect(r.suggested_chips).toEqual(["a", "b"]);
  });

  it("rejects invalid envelopes", () => {
    expect(() => parseIntakeTurnResponseOrThrow(null)).toThrow(/formato inválido/i);
    expect(() => parseIntakeTurnResponseOrThrow({})).toThrow(/sin estado de entrevista/i);
    expect(() =>
      parseIntakeTurnResponseOrThrow({
        trace: { version: 1 },
        extraction: {},
      }),
    ).toThrow(/extracción incompleta/i);
  });

  it("surfaces server error when trace is missing", () => {
    expect(() =>
      parseIntakeTurnResponseOrThrow({ error: "falló algo" }),
    ).toThrow(/falló algo/);
  });
});
