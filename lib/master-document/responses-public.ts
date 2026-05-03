/**
 * Keys under `project_responses.responses` that are internal-only (intake trace,
 * debug). Excluded from Master Document assembly and from source hash so edits
 * to trace do not look like questionnaire drift.
 */
export function stripInternalResponseKeys(
  responses: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(responses)) {
    if (key.startsWith("_")) continue;
    out[key] = responses[key];
  }
  return out;
}
