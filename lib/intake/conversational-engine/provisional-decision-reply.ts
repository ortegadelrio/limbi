export type ProvisionalDecisionUserChoice =
  | "confirm"
  | "change_priority"
  | "leave_pending";

/**
 * Classifies short replies after Limbi offered provisional guidance + three options.
 */
export function classifyProvisionalDecisionFollowUp(
  userText: string,
): ProvisionalDecisionUserChoice | null {
  const t = userText.trim().toLowerCase();
  const tFold = t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (tFold.length < 3) return null;

  if (
    /\b(dej[eé]moslo pendiente|dejemos pendiente|lo dejamos pendiente|revisamos despu[eé]s|lo revisamos despu[eé]s|para despu[eé]s|m[aá]s adelante lo vemos)\b/i.test(
      tFold,
    ) ||
    /^pendiente\b/u.test(tFold)
  ) {
    return "leave_pending";
  }

  if (
    /\b(cambiemos|prefiero la otra|prefiero otra|mejor la otra|otra prioridad|cambiar la prioridad|invertir|reordenar)\b/i.test(
      tFold,
    )
  ) {
    return "change_priority";
  }

  if (
    /\b(confirmo|me quedo con esa|me quedo as[ií]|dejemos esa|dej[eé]mos esa|as[ií] est[aá] bien|adelante con eso|vale,?\s+esa|ok,?\s+esa|perfecto,?\s+esa)\b/i.test(
      tFold,
    ) ||
    /^(s[ií]|ok|vale),?\s+(con eso|esa|as[ií])\b/u.test(tFold)
  ) {
    return "confirm";
  }

  return null;
}
