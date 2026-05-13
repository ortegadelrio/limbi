import { assertPublicExplorableHttpUrl } from "@/lib/brands/normalize-website-url";
import { BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS } from "@/lib/brands/validate-pdf-upload";

/** Exploración controlada de sitio público (mismo origen, pocas páginas). Sin crawling global. */

export const BRAND_WEB_EXPLORE_MAX_PAGES = 8;
export const BRAND_WEB_EXPLORE_FETCH_TIMEOUT_MS = 12_000;
export const BRAND_WEB_EXPLORE_MAX_BODY_BYTES = 400_000;

export type BrandWebExplorePageResult = {
  url: string;
  ok: boolean;
  note?: string;
};

/** @deprecated Use assertPublicExplorableHttpUrl; se mantiene el alias para imports existentes. */
export const assertPublicBrandWebsiteUrl = assertPublicExplorableHttpUrl;

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSameOriginHtmlLinks(html: string, pageUrl: string, maxLinks: number): string[] {
  let origin: string;
  let basePath: string;
  try {
    const u = new URL(pageUrl);
    origin = u.origin;
    basePath = u.pathname.endsWith("/") ? u.pathname : u.pathname.replace(/\/[^/]*$/, "/");
  } catch {
    return [];
  }
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < maxLinks) {
    const raw = m[1].trim();
    if (
      !raw ||
      raw.startsWith("#") ||
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:") ||
      raw.toLowerCase().startsWith("javascript:")
    ) {
      continue;
    }
    try {
      const abs = new URL(raw, origin + basePath);
      if (abs.origin !== origin) continue;
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (/\.(pdf|zip|dmg|exe|mp4|mov|m4v|jpg|jpeg|png|gif|webp|svg|ico|woff2?)(\?|$)/i.test(abs.pathname)) {
        continue;
      }
      const href = abs.href.split("#")[0] ?? abs.href;
      if (!out.includes(href)) out.push(href);
    } catch {
      /* skip */
    }
  }
  return out;
}

export type BrandWebExploreResult = {
  text: string;
  pages: BrandWebExplorePageResult[];
};

async function exploreBrandWebsiteFromOrigin(start: URL): Promise<BrandWebExploreResult> {
  const origin = start.origin;

  const suggested = [
    start.href,
    new URL("/", origin).href,
    new URL("/nosotros", origin).href,
    new URL("/about", origin).href,
    new URL("/quienes-somos", origin).href,
    new URL("/servicios", origin).href,
    new URL("/services", origin).href,
    new URL("/casos", origin).href,
    new URL("/portfolio", origin).href,
    new URL("/contacto", origin).href,
    new URL("/contact", origin).href,
  ];

  const queue: string[] = [];
  for (const s of suggested) {
    if (!queue.includes(s)) queue.push(s);
  }

  const visited = new Set<string>();
  const pages: BrandWebExplorePageResult[] = [];
  const parts: string[] = [];
  let expandedLinksFromFirstHtml = false;

  async function fetchHtml(url: string): Promise<string | null> {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), BRAND_WEB_EXPLORE_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: c.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "LimbiBrandContextBot/1.0 (+https://limbi.io)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!res.ok) {
        pages.push({ url, ok: false, note: `HTTP ${res.status}` });
        return null;
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
        pages.push({ url, ok: false, note: "No es HTML" });
        return null;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > BRAND_WEB_EXPLORE_MAX_BODY_BYTES) {
        pages.push({ url, ok: false, note: "Página demasiado grande" });
        return null;
      }
      const html = new TextDecoder("utf-8").decode(new Uint8Array(buf));
      pages.push({ url, ok: true });
      return html;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de red";
      pages.push({ url, ok: false, note: msg });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  while (queue.length > 0 && visited.size < BRAND_WEB_EXPLORE_MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchHtml(url);
    if (!html) continue;

    const plain = htmlToPlainText(html);
    if (plain.length > 0) {
      parts.push(`---\nFuente: ${url}\n---\n${plain}`);
    }

    if (!expandedLinksFromFirstHtml) {
      expandedLinksFromFirstHtml = true;
      const extra = extractSameOriginHtmlLinks(html, url, 24);
      for (const link of extra) {
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    }
  }

  const joined = parts.join("\n\n");
  const text =
    joined.length > BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS
      ? joined.slice(0, BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS)
      : joined;

  return { text, pages };
}

/**
 * Obtiene texto plano agregado desde la URL de entrada y rutas sugeridas del mismo origen.
 * No sigue enlaces externos. Máximo `BRAND_WEB_EXPLORE_MAX_PAGES` respuestas HTML procesadas.
 * Si el host es `www.` y no hay texto útil, intenta una segunda pasada en el apex del mismo dominio.
 */
export async function exploreBrandWebsiteControlled(entryUrl: string): Promise<BrandWebExploreResult> {
  const start = assertPublicExplorableHttpUrl(entryUrl);
  const primary = await exploreBrandWebsiteFromOrigin(start);
  if (primary.text.trim().length > 0) {
    return primary;
  }
  const host = start.hostname.toLowerCase();
  if (host.startsWith("www.") && host.length > 4) {
    const apex = host.slice(4);
    if (apex.includes(".")) {
      const alt = new URL(start.href);
      alt.hostname = apex;
      try {
        assertPublicExplorableHttpUrl(alt.href);
        const fallback = await exploreBrandWebsiteFromOrigin(alt);
        if (fallback.text.trim().length > 0) {
          return fallback;
        }
      } catch {
        /* mantener resultado vacío del intento principal */
      }
    }
  }
  return primary;
}