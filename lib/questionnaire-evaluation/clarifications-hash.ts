import { createHash } from "node:crypto";

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
 * Hash estable del paquete de aclaraciones (para trazabilidad en system_metadata del maestro).
 */
export function computeClarificationsPayloadHash(
  payload: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(sortKeysDeep(payload));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
