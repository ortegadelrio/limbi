import { describe, expect, it, vi } from "vitest";
import { nextMiniStep } from "@/lib/intake/guided-interview-flow";
import {
  buildDeterministicFallbackExtraction,
  combinedFallbackInterviewerMessage,
  EXTRACTION_USER_RECOVERY_NOTICE,
  resolveGuidedIntakeExtraction,
} from "@/lib/intake/guided-intake-extraction-recovery";
import { parseIntakeExtractionOutput } from "@/lib/intake/extraction-schema";
import { applyStrategicInterviewExtraction } from "@/lib/intake/strategic-interview-apply";
import { stripInternalResponseKeys } from "@/lib/master-document/responses-public";

const validExtractionJson = () =>
  JSON.stringify({
    extracted_response_updates: { strategic_base: {} },
    confidence_by_field: {},
    needs_follow_up: false,
    follow_up_question: null,
    suggested_answer_chips: [],
    answer_status: "clear",
    target_response_paths: [],
    internal_notes: "repair ok",
    interviewer_message: "Listo, sigamos.",
    public_copy_allowed: false,
  });

describe("resolveGuidedIntakeExtraction", () => {
  it("retries once with repair when first output is invalid JSON, then succeeds", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        model_used: "test-model",
        raw_json_text: "{ not valid json",
      })
      .mockResolvedValueOnce({
        model_used: "test-model",
        raw_json_text: validExtractionJson(),
      });

    const r = await resolveGuidedIntakeExtraction({
      generate,
      system: "SYS",
      schemaHint: "HINT",
      userPrompt: "USER",
      miniStep: "tailored_what",
      challengeType: "service",
      userText: "Mi respuesta",
      prevLimitations: [],
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(r.recovery).toBe("repair");
    const parsed = parseIntakeExtractionOutput(
      JSON.parse(r.raw_json_text) as unknown,
    );
    expect(parsed.ok).toBe(true);
  });

  it("uses deterministic fallback when both attempts fail validation", async () => {
    const generate = vi.fn().mockResolvedValue({
      model_used: "test-model",
      raw_json_text: "{",
    });

    const r = await resolveGuidedIntakeExtraction({
      generate,
      system: "SYS",
      schemaHint: "HINT",
      userPrompt: "USER",
      miniStep: "problem",
      challengeType: null,
      userText: "El problema es la confusión al contratar.",
      prevLimitations: [],
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(r.recovery).toBe("fallback");
    expect(r.extraction.answer_status).toBe("fallback_saved");
    expect(r.extraction.interviewer_message).not.toMatch(/Extracci/i);
    expect(r.extraction.interviewer_message).toContain(
      EXTRACTION_USER_RECOVERY_NOTICE.slice(0, 20),
    );
  });
});

describe("buildDeterministicFallbackExtraction", () => {
  it("produces schema-valid output for tailored_what", () => {
    const ex = buildDeterministicFallbackExtraction(
      "tailored_what",
      "Ofrezco coaching para equipos remotos.",
      [],
    );
    const p = parseIntakeExtractionOutput(ex);
    expect(p.ok).toBe(true);
    if (p.ok) {
      const { mergedResponses } = applyStrategicInterviewExtraction({}, p.data);
      const sb = mergedResponses.strategic_base as Record<string, unknown>;
      expect(String(sb.simple_description)).toContain("coaching");
    }
  });

  it("advances mini_step conceptually: next step after problem is transformation", () => {
    expect(nextMiniStep("problem")).toBe("transformation");
  });
});

describe("combinedFallbackInterviewerMessage", () => {
  it("never exposes internal validation jargon", () => {
    const m = combinedFallbackInterviewerMessage();
    expect(m).not.toMatch(/Extracci|schema|zod|JSON/i);
  });
});

describe("stripInternalResponseKeys with merged pilot responses", () => {
  it("removes trace key so Master input would not include raw interview trace", () => {
    const merged = {
      strategic_base: { simple_description: "x".repeat(20) },
      _limbic_interview_v1: { version: 1, turns: [{ raw: "secret" }] },
    };
    const pub = stripInternalResponseKeys(merged);
    expect(pub._limbic_interview_v1).toBeUndefined();
    expect(
      (pub.strategic_base as { simple_description: string }).simple_description,
    ).toContain("x");
  });
});
