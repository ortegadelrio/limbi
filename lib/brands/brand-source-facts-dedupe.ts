import { createHash } from "node:crypto";

const MAX_FINGERPRINT_SOURCE = 2000;

/** Normalización simple v1: minúsculas, espacios, sin puntuación frecuente. */
export function normalizeForBrandSourceFactFingerprint(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, MAX_FINGERPRINT_SOURCE);
}

export function buildBrandSourceFactFingerprint(parts: {
  proposed_inclusion: string;
  extracted_fact: string;
  section_key: string;
  question_key: string | null;
}): string {
  const pi = normalizeForBrandSourceFactFingerprint(parts.proposed_inclusion);
  const ef = normalizeForBrandSourceFactFingerprint(parts.extracted_fact);
  const qk = parts.question_key
    ? normalizeForBrandSourceFactFingerprint(parts.question_key)
    : "";
  const sk = normalizeForBrandSourceFactFingerprint(parts.section_key);
  const raw = `${sk}|${qk}|${pi}|${ef}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
