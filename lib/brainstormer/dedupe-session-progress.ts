import type { BrainstormerSessionProgressPayload } from "@/lib/schemas/brainstormer-session";
import { textMentionsThirdPartyIp } from "@/lib/brainstormer/third-party-ip-guardrail";

type StringProgressField = {
  [K in keyof BrainstormerSessionProgressPayload]-?: BrainstormerSessionProgressPayload[K] extends string
    ? K
    : never;
}[keyof BrainstormerSessionProgressPayload];

function setProgressStringField(
  target: BrainstormerSessionProgressPayload,
  key: StringProgressField,
  value: string,
): void {
  (target as Record<StringProgressField, string>)[key] = value;
}

function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, " ")
    .trim();
}

function splitBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-–*]+/, "").trim())
    .filter((line) => line.length > 0);
}

function bulletClusterKey(line: string): string | null {
  if (textMentionsThirdPartyIp(line)) return "__third_party_ip__";
  if (/desde cero|sin notas|no tiene notas/i.test(line)) return "__no_material__";
  if (/conferencias?|conferencista/i.test(line)) return "__conferences_goal__";
  return null;
}

function isDuplicateBullet(a: string, b: string): boolean {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (ka === kb) return true;
  if (ka.length > 12 && kb.length > 12 && (ka.includes(kb) || kb.includes(ka))) return true;
  if (textMentionsThirdPartyIp(a) && textMentionsThirdPartyIp(b)) return true;
  if (
    /desde cero|sin notas|no tiene notas/i.test(a) &&
    /desde cero|sin notas|no tiene notas/i.test(b)
  ) {
    return true;
  }
  return false;
}

/** Elimina viñetas repetidas o casi idénticas dentro de un bloque de texto. */
export function dedupeBulletText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const lines = splitBullets(trimmed);
  const unique: string[] = [];
  const seenClusters = new Set<string>();

  for (const line of lines) {
    const cluster = bulletClusterKey(line);
    if (cluster && seenClusters.has(cluster)) continue;

    if (!unique.some((u) => isDuplicateBullet(u, line))) {
      unique.push(line);
      if (cluster) seenClusters.add(cluster);
    }
  }

  const ipLines = unique.filter((line) => textMentionsThirdPartyIp(line));
  const nonIp = unique.filter((line) => !textMentionsThirdPartyIp(line));
  const collapsed = ipLines.length > 1 ? [...nonIp, ipLines[ipLines.length - 1]!] : unique;

  if (collapsed.length <= 1 && !trimmed.includes("\n")) return collapsed[0] ?? "";
  return collapsed.map((line) => `- ${line}`).join("\n");
}

const TEXT_FIELDS = [
  "session_summary",
  "current_challenge",
  "preliminary_objective",
  "audience_notes",
  "tension_or_pain",
  "opportunities",
  "ideas_explored",
  "recommended_routes",
  "open_questions",
  "next_step",
  "project_seed_summary",
] as const satisfies readonly StringProgressField[];

/** Deduplica ideas y pendientes; evita guardrail de IP repetido en varios campos. */
export function dedupeSessionProgressFields(
  progress: BrainstormerSessionProgressPayload,
): BrainstormerSessionProgressPayload {
  const out = { ...progress };
  let ipNoteSeen = false;

  for (const key of TEXT_FIELDS) {
    const value = out[key];
    if (typeof value !== "string" || !value.trim()) continue;

    if (key === "ideas_explored" || key === "open_questions") {
      setProgressStringField(out, key, dedupeBulletText(value));
      continue;
    }

    if (textMentionsThirdPartyIp(value)) {
      if (ipNoteSeen) {
        setProgressStringField(out, key, "");
      } else {
        ipNoteSeen = true;
      }
    }
  }

  return out;
}