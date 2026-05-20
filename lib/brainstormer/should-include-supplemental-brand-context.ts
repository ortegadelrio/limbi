/** Turno pide evidencia, credenciales, catálogo o revisión detallada de la base. */
export function shouldIncludeSupplementalBrandContext(
  userMessage: string,
  conversationExcerpt = "",
): boolean {
  const t = `${userMessage}\n${conversationExcerpt}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  return (
    /\b(evidencia|credencial|credibilidad|prueba|caso[s]?|dato[s]? concret|autoridad|reputaci[oó]n)\b/.test(
      t,
    ) ||
    /\b(qu[eé]\s+(servicios?|ofrece|productos?)|cat[aá]logo|offer|servicio[s]?)\b/.test(t) ||
    /\b(restricci[oó]n|riesgo[s]?|tensi[oó]n|alerta[s]?)\b/.test(t) ||
    /\b(revis(ar|emos)|detall(e|ar)|profundiz(ar|emos))\s+(la\s+)?(base|marca|conocimiento)\b/.test(
      t,
    ) ||
    /\b(credibility|proof|case study|evidence)\b/.test(t)
  );
}
