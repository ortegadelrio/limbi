import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Legacy response_job / response_mode names — must not reappear in lib/brainstormer. */
const FORBIDDEN_LEGACY_RESPONSE_IDENTIFIERS = [
  "guide_to_campaign_concept",
  "explain_more_simply",
  "validate_or_improve_concept",
  "answer_expectation_mechanism",
  "answer_next_step",
  "answer_next_step_after_concept",
  "answer_tactical_only_if_strategy_ready",
  "answer_conversion_bridge",
  "propose_alternative_concepts",
  "answer_audience_strategy",
  "response_job",
] as const;

const GUARD_TEST_BASENAME = "brainstormer-response-mode-legacy.guard.test.ts";

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules") continue;
      collectTsFiles(full, acc);
    } else if (name.endsWith(".ts") && name !== GUARD_TEST_BASENAME) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Brainstormer — sin identificadores legacy de response_job/response_mode", () => {
  it("ningún archivo en lib/brainstormer contiene modos o response_job obsoletos", () => {
    const root = __dirname;
    const files = collectTsFiles(root);
    const violations: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const term of FORBIDDEN_LEGACY_RESPONSE_IDENTIFIERS) {
        if (src.includes(term)) {
          violations.push(`${path.relative(root, file)}: ${term}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
