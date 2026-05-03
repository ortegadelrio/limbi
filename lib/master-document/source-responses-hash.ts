import { createHash } from "node:crypto";
import { stripInternalResponseKeys } from "@/lib/master-document/responses-public";

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const o = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(o).sort()) {
    sorted[key] = sortKeysDeep(o[key]);
  }
  return sorted;
}

/**
 * Stable SHA-256 over canonical JSON of `project_responses.responses`.
 * Used to detect whether the questionnaire changed since the active master was built.
 */
export function computeSourceResponsesHash(
  responses: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(sortKeysDeep(stripInternalResponseKeys(responses)));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
