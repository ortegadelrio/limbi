/**
 * Normaliza el sitio web para marcas y para exploración web controlada (Ticket H.2).
 * Si no hay protocolo, antepone https:// antes de validar o guardar.
 */

/** Mensaje visible cuando la URL no se puede interpretar o no cumple reglas públicas (salvo red local explícita). */
export const BRAND_WEB_EXPLORE_URL_HELP_ES =
  "No pudimos leer esa dirección. Prueba escribiéndola como agenciapopuli.com o https://agenciapopuli.com.";

/** Quita espacios invisibles comunes y recorta. */
export function sanitizeWebsiteUrlInput(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeWebsiteUrlFromSanitized(t: string): string {
  if (!t) return "";
  if (/^(javascript|data|file|vbscript):/i.test(t)) {
    return "";
  }
  if (/^\/\//.test(t)) {
    return `https:${t}`;
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  return `https://${t}`;
}

/**
 * Normaliza el sitio web para marcas (y futuros campos similares).
 * Si no hay protocolo, antepone https:// antes de validar o guardar.
 */
export function normalizeWebsiteUrl(value: string): string {
  return normalizeWebsiteUrlFromSanitized(sanitizeWebsiteUrlInput(value));
}

export function isValidHttpUrl(normalized: string): boolean {
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return Boolean(u.hostname && u.hostname.length > 0);
  } catch {
    return false;
  }
}

/** Hostname con forma de dominio público (punto) o dirección IP / IPv6. Rechaza etiquetas simples tipo "intranet". */
export function hostnameHasExplorablePublicDnsShape(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(h)) return true;
  if (h.includes(":")) return true;
  return h.includes(".");
}

export function hostnameLooksPrivate(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (h.includes(":")) {
    if (h.startsWith("fe80:")) return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("::ffff:")) {
      const tail = h.slice("::ffff:".length);
      return hostnameLooksPrivate(tail);
    }
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Valida URL pública http(s) para exploración de sitio de marca.
 * Normaliza (https si falta protocolo), rechaza esquemas peligrosos, hosts privados y nombres sin punto (p. ej. intranet).
 */
export function assertPublicExplorableHttpUrl(input: string): URL {
  const pre = sanitizeWebsiteUrlInput(input);
  if (!pre) {
    throw new Error("Ingresá una URL.");
  }
  if (/^(javascript|data|file|vbscript):/i.test(pre)) {
    throw new Error(BRAND_WEB_EXPLORE_URL_HELP_ES);
  }
  const normalized = normalizeWebsiteUrlFromSanitized(pre);
  if (!normalized) {
    throw new Error(BRAND_WEB_EXPLORE_URL_HELP_ES);
  }
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    throw new Error(BRAND_WEB_EXPLORE_URL_HELP_ES);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(BRAND_WEB_EXPLORE_URL_HELP_ES);
  }
  if (hostnameLooksPrivate(u.hostname)) {
    throw new Error("Esa dirección no está permitida (red privada o local).");
  }
  if (!hostnameHasExplorablePublicDnsShape(u.hostname)) {
    throw new Error(BRAND_WEB_EXPLORE_URL_HELP_ES);
  }
  return u;
}
