import { computeSourceResponsesHash } from "@/lib/master-document/source-responses-hash";

export function extractSourceResponsesHashFromMasterDocument(
  document: unknown,
): string | null {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return null;
  }
  const sm = (document as Record<string, unknown>).system_metadata;
  if (!sm || typeof sm !== "object" || Array.isArray(sm)) {
    return null;
  }
  const h = (sm as Record<string, unknown>).source_responses_hash;
  return typeof h === "string" && h.length > 0 ? h : null;
}

export function computeResponsesHaveChangedSinceMaster(
  responsesObj: Record<string, unknown>,
  activeMasterDocument: unknown,
): boolean {
  const masterStoredHash =
    extractSourceResponsesHashFromMasterDocument(activeMasterDocument);
  const currentResponsesHash = computeSourceResponsesHash(responsesObj);
  return masterStoredHash === null
    ? true
    : currentResponsesHash !== masterStoredHash;
}

/**
 * El marco visible mostrado no corresponde al Documento Maestro activo actual.
 */
export function computeFrameworkIsOutdatedSinceMaster(
  visibleMasterDocumentId: string | null | undefined,
  activeMasterId: string | null | undefined,
): boolean {
  if (!activeMasterId) return false;
  if (visibleMasterDocumentId == null || visibleMasterDocumentId === "") {
    return true;
  }
  return visibleMasterDocumentId !== activeMasterId;
}
