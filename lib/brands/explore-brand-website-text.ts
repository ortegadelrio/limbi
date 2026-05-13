import { assertPublicExplorableHttpUrl } from "@/lib/brands/normalize-website-url";
import { BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS } from "@/lib/brands/validate-pdf-upload";

/** Exploración controlada de sitio público (mismo sitio de marca, pocas páginas). Sin crawling global. */

export const BRAND_WEB_EXPLORE_MAX_PAGES = 8;
export const BRAND_WEB_EXPLORE_FETCH_TIMEOUT_MS = 12_000;
export const BRAND_WEB_EXPLORE_MAX_BODY_BYTES = 400_000;

/** Umbral: por debajo se considera “poco texto útil” para copy de UI (200 sigue siendo material revisable). */
export const BRAND_WEB_EXPLORE_LOW_TEXT_CHAR_THRESHOLD = 800;
export const BRAND_WEB_EXPLORE_MIN_USEFUL_PAGE_CHARS = 80;

export const BRAND_WEB_EXPLORE_UA_LIMBI = "LimbiBot/1.0 (+https://limbi.io)";
export const BRAND_WEB_EXPLORE_UA_BROWSER =
  "Mozilla/5.0 (compatible; LimbiBot/1.0; +https://limbi.io) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const BRAND_WEB_EXPLORE_MSG_SUCCESS = (pageCount: number) =>
  `Sitio leído. Limbi encontró contenido útil en ${pageCount} página${pageCount === 1 ? "" : "s"} y lo agregó como material de contexto.`;

export const BRAND_WEB_EXPLORE_MSG_LOW_TEXT =
  "Limbi pudo abrir el sitio, pero encontró poco texto útil.";

export const BRAND_WEB_EXPLORE_MSG_FAILED =
  "No pudimos leer suficiente información del sitio. Prueba con otra URL del mismo dominio o sube un archivo con el contenido.";

export const BRAND_WEB_EXPLORE_MSG_JS_SHELL =
  "No pudimos leer suficiente texto del sitio. Es posible que la página cargue su contenido con JavaScript o bloquee lecturas automáticas. Puedes subir un PDF, DOCX, TXT o pegar el contenido en un archivo .txt.";

export const BRAND_WEB_EXPLORE_MSG_BLOCKED =
  "No pudimos leer suficiente información del sitio. Es posible que restrinja el acceso automático. Prueba con otra URL del mismo dominio o sube un archivo con el contenido.";

/** Sitio que responde con pantalla de “habilitá JavaScript” / challenge (Cloudflare, etc.). */
export const BRAND_WEB_EXPLORE_MSG_JS_BLOCKED =
  "No pudimos leer este sitio porque exige JavaScript o bloquea lecturas automáticas. Puedes subir un PDF, Word o TXT con la información de la marca, o probar con una página pública más simple del mismo sitio.";

/** Recomendación práctica en UI (limitación del sitio, no falla del usuario). */
export const BRAND_WEB_EXPLORE_MSG_UI_RECOMMENDATION_JS_BLOCK =
  "Este sitio no entrega texto legible a Limbi desde servidor. Para continuar, sube un archivo con el contenido o copia la información principal en un .txt.";

export const BRAND_WEB_EXPLORE_CHALLENGE_RECOMMENDATION_CODE = "upload_file_or_try_static_page" as const;

export type BrandWebExplorePageResult = {
  url: string;
  ok: boolean;
  note?: string;
  finalUrl?: string;
  httpStatus?: number | null;
  contentType?: string | null;
  bodyBytes?: number;
  timeout?: boolean;
  usefulText?: boolean;
  charsBeforeClean?: number;
  charsAfterClean?: number;
};

export type BrandWebExploreTechnicalSummary = {
  source_kind: "website_crawl";
  entry_url: string;
  final_urls: string[];
  pages_attempted: number;
  pages_succeeded: number;
  pages_with_useful_text: number;
  characters_extracted: number;
  characters_before_clean: number;
  characters_after_clean: number;
  failure_reasons: string[];
  likely_js_shell: boolean;
  access_limited: boolean;
  /** HTML de challenge / “habilitá JavaScript” / anti-bot, sin contenido útil recuperado. */
  blocked_by_javascript_or_challenge?: boolean;
  detected_blocking_message?: string;
  challenge_final_url?: string;
  recommendation?: typeof BRAND_WEB_EXPLORE_CHALLENGE_RECOMMENDATION_CODE;
};

export type BrandWebExploreOutcome =
  | "success"
  | "low_text"
  | "failed"
  | "blocked"
  | "js_shell"
  | "js_blocked";

export type BrandWebExploreChallengeSourceMetadata = {
  blocked_by_javascript_or_challenge: true;
  detected_blocking_message: string;
  entry_url: string;
  final_url: string;
  recommendation: typeof BRAND_WEB_EXPLORE_CHALLENGE_RECOMMENDATION_CODE;
};

export type BrandWebExploreControlledResult = {
  text: string;
  pages: BrandWebExplorePageResult[];
  summary: BrandWebExploreTechnicalSummary;
  outcome: BrandWebExploreOutcome;
  userMessage: string;
  /** Segunda línea de copy (p. ej. 422 js_blocked). */
  userRecommendation?: string;
  /** Metadatos para respuesta API / `source_metadata` cuando no hay documento. */
  challengeSourceMetadata?: BrandWebExploreChallengeSourceMetadata;
};

/** @deprecated Use assertPublicExplorableHttpUrl; se mantiene el alias para imports existentes. */
export const assertPublicBrandWebsiteUrl = assertPublicExplorableHttpUrl;

function webExploreLog(payload: Record<string, unknown>): void {
  if (process.env.VITEST === "true") return;
  console.info("[brand-web-explore]", JSON.stringify(payload));
}

export function siteKeyHostname(hostname: string): string {
  const h = hostname.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

export function sameBrandSiteHostname(a: string, b: string): boolean {
  return siteKeyHostname(a) === siteKeyHostname(b);
}

function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

function extractTagInner(html: string, re: RegExp): string | undefined {
  const m = re.exec(html);
  if (!m?.[1]) return undefined;
  return decodeBasicHtmlEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTitle(html: string): string | undefined {
  return extractTagInner(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
}

function extractMetaDescription(html: string): string | undefined {
  const byName = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  if (byName) return decodeBasicHtmlEntities(byName.trim());
  const byNameRev = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  )?.[1];
  if (byNameRev) return decodeBasicHtmlEntities(byNameRev.trim());
  return undefined;
}

function extractOg(html: string): { ogTitle?: string; ogDesc?: string } {
  const pick = (prop: "og:title" | "og:description") => {
    const a = html.match(
      new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    )?.[1];
    if (a) return decodeBasicHtmlEntities(a.trim());
    const b = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
    )?.[1];
    return b ? decodeBasicHtmlEntities(b.trim()) : undefined;
  };
  return { ogTitle: pick("og:title"), ogDesc: pick("og:description") };
}

function extractHeadingLines(html: string, max: number): string[] {
  const out: string[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < max) {
    const inner = decodeBasicHtmlEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (inner.length > 2) out.push(inner);
  }
  return out;
}

function extractJsonLdSnippets(html: string, maxSnippets: number): string[] {
  const out: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < maxSnippets) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const buf: string[] = [];
      const walk = (node: unknown, depth: number) => {
        if (depth > 6 || buf.length >= 8) return;
        if (typeof node === "string") {
          const t = node.trim();
          if (t.length > 35 && t.length < 4000) buf.push(t);
          return;
        }
        if (Array.isArray(node)) {
          for (const it of node) walk(it, depth + 1);
          return;
        }
        if (node && typeof node === "object") {
          for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            if (/^(description|name|headline|alternateName|about)$/i.test(k)) {
              if (typeof v === "string" && v.trim().length > 20) buf.push(v.trim());
              else walk(v, depth + 1);
            }
          }
        }
      };
      walk(parsed, 0);
      for (const s of buf) {
        if (out.length >= maxSnippets) break;
        out.push(decodeBasicHtmlEntities(s.replace(/\s+/g, " ")));
      }
    } catch {
      /* JSON inválido: omitir */
    }
  }
  return out;
}

function removeHeavyAndBoilerplate(html: string): string {
  let h = html;
  h = h.replace(/<script[\s\S]*?<\/script>/gi, " ");
  h = h.replace(/<style[\s\S]*?<\/style>/gi, " ");
  h = h.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  h = h.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  h = h.replace(/<canvas[\s\S]*?<\/canvas>/gi, " ");
  for (let i = 0; i < 4; i++) {
    h = h.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ");
  }
  for (let i = 0; i < 3; i++) {
    h = h.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ");
  }
  return h;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function dedupeLinesAndPhrases(text: string): string {
  const chunks = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of chunks) {
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (key.length >= 24 && seen.has(key)) continue;
    if (key.length >= 24) seen.add(key);
    out.push(line);
  }
  return out.join("\n");
}

export type HtmlPlainTextMetrics = {
  text: string;
  charsBeforeClean: number;
  charsAfterClean: number;
  scriptOpenCount: number;
};

export function extractPlainTextFromHtml(html: string): HtmlPlainTextMetrics {
  const scriptOpenCount = (html.match(/<script\b/gi) ?? []).length;
  const strippedComments = stripHtmlComments(html);
  const title = extractTitle(strippedComments);
  const metaDesc = extractMetaDescription(strippedComments);
  const { ogTitle, ogDesc } = extractOg(strippedComments);
  const headings = extractHeadingLines(strippedComments, 24);
  const jsonLd = extractJsonLdSnippets(strippedComments, 6);

  const prefixParts = [title, metaDesc, ogTitle, ogDesc, ...headings, ...jsonLd]
    .filter(Boolean)
    .map((s) => collapseWhitespace(String(s)));

  const heavyOut = removeHeavyAndBoilerplate(strippedComments);
  const bodyFlat = collapseWhitespace(
    decodeBasicHtmlEntities(heavyOut.replace(/<[^>]+>/g, " ")),
  );

  const mergedPrefix = prefixParts.join("\n");
  const beforeDedupe = [mergedPrefix, bodyFlat].filter(Boolean).join("\n\n");
  const charsBeforeClean = beforeDedupe.length;
  const deduped = dedupeLinesAndPhrases(beforeDedupe);
  const charsAfterClean = deduped.length;
  return {
    text: deduped,
    charsBeforeClean,
    charsAfterClean,
    scriptOpenCount,
  };
}

/** Patrones típicos de “habilitá JavaScript”, Cloudflare o challenge anti-bot en HTML estático. */
const JS_OR_CHALLENGE_HTML_NEEDLES = [
  "javascript is required",
  "please enable javascript",
  "enable javascript and cookies",
  "checking your browser",
  "just a moment",
  "access denied",
  "cloudflare",
  "attention required",
] as const;

export type JavascriptChallengeDetection =
  | { blocked: false }
  | { blocked: true; matchedSnippet: string };

/**
 * Detecta respuestas que no son contenido de marca útil, sino pantalla de bloqueo o dependencia de JS en cliente.
 */
export function detectJavascriptOrAntiBotChallenge(html: string): JavascriptChallengeDetection {
  const sample = html.slice(0, 600_000);
  const normalized = sample.toLowerCase().replace(/\s+/g, " ");
  for (const needle of JS_OR_CHALLENGE_HTML_NEEDLES) {
    const idx = normalized.indexOf(needle);
    if (idx !== -1) {
      const rawWindow = sample.slice(Math.max(0, idx - 24), idx + 160);
      const snippet = rawWindow.replace(/\s+/g, " ").trim().slice(0, 500);
      return { blocked: true, matchedSnippet: snippet || needle };
    }
  }
  return { blocked: false };
}

export function detectLikelyJsRenderedShell(
  html: string,
  metrics: Pick<HtmlPlainTextMetrics, "text" | "scriptOpenCount">,
): boolean {
  const t = metrics.text.trim();
  if (t.length >= 420) return false;
  const sample = html.slice(0, 150_000).toLowerCase();
  const rootish =
    /\bid=["']__next["']/.test(sample) ||
    /\bid=["']root["']/.test(sample) ||
    /\bid=["']app["']/.test(sample) ||
    /data-nextjs-scroll-focus-boundary/.test(sample);
  const longHtml = html.length > 7000;
  const heavyScripts = metrics.scriptOpenCount >= 8 || sample.split("<script").length > 10;
  return longHtml && (rootish || heavyScripts) && t.length < 320;
}

/**
 * Texto legible desde HTML (sin motor DOM ni dependencias nuevas).
 * Conserva title, meta, encabezados y cuerpo; deduplica líneas repetidas.
 */
export function htmlToPlainText(html: string): string {
  return extractPlainTextFromHtml(html).text;
}

export function extractSameOriginHtmlLinks(html: string, pageUrl: string, maxLinks: number): string[] {
  let pageHostname: string;
  let basePath: string;
  let origin: string;
  try {
    const u = new URL(pageUrl);
    pageHostname = u.hostname.toLowerCase();
    basePath = u.pathname.endsWith("/") ? u.pathname : u.pathname.replace(/\/[^/]*$/, "/");
    origin = u.origin;
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
      if (!sameBrandSiteHostname(abs.hostname, pageHostname)) continue;
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (
        /\.(pdf|zip|dmg|exe|mp4|mov|m4v|jpg|jpeg|png|gif|webp|svg|ico|woff2?|css|js|map|json)(\?|$)/i.test(
          abs.pathname,
        )
      ) {
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

type FetchHtmlOutcome = {
  html: string | null;
  diag: BrandWebExplorePageResult;
};

const DEFAULT_FETCH_HEADERS: Record<string, string> = {
  "User-Agent": BRAND_WEB_EXPLORE_UA_LIMBI,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.7",
};

const ALT_FETCH_HEADERS: Record<string, string> = {
  ...DEFAULT_FETCH_HEADERS,
  "User-Agent": BRAND_WEB_EXPLORE_UA_BROWSER,
};

async function fetchHtmlOnce(url: string, headers: Record<string, string>): Promise<FetchHtmlOutcome> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), BRAND_WEB_EXPLORE_FETCH_TIMEOUT_MS);
  const baseDiag: Omit<BrandWebExplorePageResult, "ok" | "note" | "finalUrl" | "httpStatus"> = {
    url,
    contentType: null,
    bodyBytes: 0,
    timeout: false,
  };
  try {
    const res = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers,
    });
    const finalUrl = res.url || url;
    const httpStatus = res.status;
    const contentType = res.headers.get("content-type");
    baseDiag.contentType = contentType;
    if (!res.ok) {
      return {
        html: null,
        diag: {
          ...baseDiag,
          ok: false,
          finalUrl,
          httpStatus,
          note: `HTTP ${res.status}`,
        },
      };
    }
    const ct = contentType ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return {
        html: null,
        diag: {
          ...baseDiag,
          ok: false,
          finalUrl,
          httpStatus,
          note: "content_type_not_html",
        },
      };
    }
    const buf = await res.arrayBuffer();
    baseDiag.bodyBytes = buf.byteLength;
    if (buf.byteLength > BRAND_WEB_EXPLORE_MAX_BODY_BYTES) {
      return {
        html: null,
        diag: {
          ...baseDiag,
          ok: false,
          finalUrl,
          httpStatus,
          note: "body_too_large",
        },
      };
    }
    const html = new TextDecoder("utf-8").decode(new Uint8Array(buf));
    return {
      html,
      diag: {
        ...baseDiag,
        ok: true,
        finalUrl,
        httpStatus,
      },
    };
  } catch (e) {
    const aborted = e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message));
    return {
      html: null,
      diag: {
        ...baseDiag,
        ok: false,
        finalUrl: url,
        httpStatus: null,
        timeout: aborted,
        note: aborted ? "timeout" : e instanceof Error ? "network_error" : "fetch_error",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlWithDiagnostics(url: string): Promise<FetchHtmlOutcome> {
  const first = await fetchHtmlOnce(url, DEFAULT_FETCH_HEADERS);
  if (
    first.html === null &&
    (first.diag.httpStatus === 403 || first.diag.httpStatus === 429) &&
    !first.diag.timeout
  ) {
    const second = await fetchHtmlOnce(url, ALT_FETCH_HEADERS);
    if (second.html !== null) return second;
    return second;
  }
  return first;
}

type OriginExploreState = {
  text: string;
  pages: BrandWebExplorePageResult[];
  finalUrls: Set<string>;
  failureCodes: Set<string>;
  charsBeforeClean: number;
  charsAfterClean: number;
  pagesUseful: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  likelyJsShell: boolean;
  /** Última respuesta HTML con challenge / “habilitá JavaScript” en este intento de origen. */
  lastChallengeBlock: null | { detectedSnippet: string; finalUrl: string };
};

async function exploreBrandWebsiteFromOrigin(start: URL, entryHref: string): Promise<OriginExploreState> {
  const origin = start.origin;
  const pageHostname = start.hostname.toLowerCase();

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

  const finalUrls = new Set<string>();
  const failureCodes = new Set<string>();
  let charsBeforeClean = 0;
  let charsAfterClean = 0;
  let pagesUseful = 0;
  let pagesAttempted = 0;
  let pagesSucceeded = 0;
  let likelyJsShell = false;
  let lastChallengeBlock: null | { detectedSnippet: string; finalUrl: string } = null;

  while (queue.length > 0 && visited.size < BRAND_WEB_EXPLORE_MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    pagesAttempted += 1;

    const { html, diag } = await fetchHtmlWithDiagnostics(url);
    const enriched: BrandWebExplorePageResult = { ...diag };

    if (!html) {
      if (enriched.note) failureCodes.add(String(enriched.note));
      if (enriched.httpStatus === 403 || enriched.httpStatus === 401 || enriched.httpStatus === 429) {
        failureCodes.add(`http_${enriched.httpStatus}`);
      }
      pages.push(enriched);
      webExploreLog({
        event: "fetch_page",
        entry: entryHref,
        url,
        ok: false,
        httpStatus: enriched.httpStatus,
        finalUrl: enriched.finalUrl,
        contentType: enriched.contentType,
        bodyBytes: enriched.bodyBytes,
        timeout: enriched.timeout,
        note: enriched.note,
      });
      continue;
    }

    pagesSucceeded += 1;
    if (enriched.finalUrl) finalUrls.add(enriched.finalUrl);

    const challenge = detectJavascriptOrAntiBotChallenge(html);
    if (challenge.blocked) {
      failureCodes.add("js_or_challenge_html");
      enriched.note = "js_or_challenge_html";
      enriched.ok = true;
      enriched.usefulText = false;
      lastChallengeBlock = {
        detectedSnippet: challenge.matchedSnippet,
        finalUrl: enriched.finalUrl ?? url,
      };
      pages.push(enriched);
      webExploreLog({
        event: "fetch_page",
        entry: entryHref,
        url,
        ok: true,
        httpStatus: enriched.httpStatus,
        finalUrl: enriched.finalUrl,
        contentType: enriched.contentType,
        bodyBytes: enriched.bodyBytes,
        jsOrChallengeHtml: true,
      });
      if (!expandedLinksFromFirstHtml) {
        expandedLinksFromFirstHtml = true;
        const extra = extractSameOriginHtmlLinks(html, enriched.finalUrl ?? url, 24);
        for (const link of extra) {
          try {
            const abs = new URL(link);
            if (!sameBrandSiteHostname(abs.hostname, pageHostname)) continue;
          } catch {
            continue;
          }
          if (!visited.has(link) && !queue.includes(link)) queue.push(link);
        }
      }
      continue;
    }

    const metrics = extractPlainTextFromHtml(html);
    charsBeforeClean += metrics.charsBeforeClean;
    charsAfterClean += metrics.charsAfterClean;
    const plain = metrics.text.trim();
    const shellHere = detectLikelyJsRenderedShell(html, metrics);
    if (shellHere) likelyJsShell = true;
    enriched.usefulText = plain.length >= BRAND_WEB_EXPLORE_MIN_USEFUL_PAGE_CHARS;
    enriched.charsBeforeClean = metrics.charsBeforeClean;
    enriched.charsAfterClean = plain.length;
    if (enriched.usefulText) pagesUseful += 1;
    enriched.ok = true;
    pages.push(enriched);

    webExploreLog({
      event: "fetch_page",
      entry: entryHref,
      url,
      ok: true,
      httpStatus: enriched.httpStatus,
      finalUrl: enriched.finalUrl,
      contentType: enriched.contentType,
      bodyBytes: enriched.bodyBytes,
      usefulText: enriched.usefulText,
      charsAfterClean: plain.length,
      likelyJsShell: shellHere,
    });

    if (plain.length > 0) {
      parts.push(`---\nFuente: ${enriched.finalUrl ?? url}\n---\n${plain}`);
    }

    if (!expandedLinksFromFirstHtml) {
      expandedLinksFromFirstHtml = true;
      const extra = extractSameOriginHtmlLinks(html, enriched.finalUrl ?? url, 24);
      for (const link of extra) {
        try {
          const abs = new URL(link);
          if (!sameBrandSiteHostname(abs.hostname, pageHostname)) continue;
        } catch {
          continue;
        }
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    }
  }

  let joined = parts.join("\n\n");
  if (joined.length > BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS) {
    joined = joined.slice(0, BRAND_DOCUMENT_MAX_EXTRACTED_TEXT_CHARS);
  }

  return {
    text: joined,
    pages,
    finalUrls,
    failureCodes,
    charsBeforeClean,
    charsAfterClean,
    pagesUseful,
    pagesAttempted,
    pagesSucceeded,
    likelyJsShell,
    lastChallengeBlock,
  };
}

function buildHttpsCandidates(entry: URL): URL[] {
  const list: URL[] = [];
  const pushUnique = (u: URL) => {
    if (!list.some((x) => x.href === u.href)) list.push(u);
  };
  pushUnique(entry);
  const h = entry.hostname.toLowerCase();
  try {
    if (h.startsWith("www.") && h.length > 4) {
      const alt = new URL(entry.href);
      alt.hostname = h.slice(4);
      pushUnique(alt);
    } else if (!h.startsWith("www.") && h.includes(".")) {
      const alt = new URL(entry.href);
      alt.hostname = `www.${h}`;
      pushUnique(alt);
    }
  } catch {
    /* hostname alterno inválido */
  }
  return list;
}

function buildHttpFallbackCandidates(entry: URL): URL[] {
  if (entry.protocol === "http:") return [];
  const out: URL[] = [];
  const add = (hostname: string) => {
    try {
      const u = new URL(entry.href);
      u.protocol = "http:";
      u.hostname = hostname;
      if (!out.some((x) => x.href === u.href)) out.push(u);
    } catch {
      /* skip */
    }
  };
  const h = entry.hostname.toLowerCase();
  add(h);
  if (h.startsWith("www.") && h.length > 4) {
    add(h.slice(4));
  } else if (!h.startsWith("www.") && h.includes(".")) {
    add(`www.${h}`);
  }
  return out;
}

function mergePagesUnique(prev: BrandWebExplorePageResult[], next: BrandWebExplorePageResult[]) {
  const seen = new Set(prev.map((p) => `${p.url}|${p.note ?? ""}|${p.ok}`));
  const out = [...prev];
  for (const p of next) {
    const k = `${p.url}|${p.note ?? ""}|${p.ok}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

function accessLimitedFromPages(pages: BrandWebExplorePageResult[]): boolean {
  const fails = pages.filter((p) => !p.ok);
  if (fails.length === 0) return false;
  return fails.every(
    (p) =>
      p.httpStatus === 403 ||
      p.httpStatus === 401 ||
      p.httpStatus === 429 ||
      p.note === "HTTP 403" ||
      p.note === "HTTP 401" ||
      p.note === "HTTP 429",
  );
}

function buildSummary(
  entryHref: string,
  state: OriginExploreState,
  protocolPhase: "https" | "http_fallback",
): BrandWebExploreTechnicalSummary {
  const textLen = state.text.trim().length;
  const failures = [...state.failureCodes, ...(protocolPhase === "http_fallback" ? ["http_fallback_used"] : [])];
  return {
    source_kind: "website_crawl",
    entry_url: entryHref,
    final_urls: [...state.finalUrls].slice(0, 16),
    pages_attempted: state.pagesAttempted,
    pages_succeeded: state.pagesSucceeded,
    pages_with_useful_text: state.pagesUseful,
    characters_extracted: textLen,
    characters_before_clean: state.charsBeforeClean,
    characters_after_clean: state.charsAfterClean,
    failure_reasons: failures.slice(0, 40),
    likely_js_shell: state.likelyJsShell,
    access_limited: accessLimitedFromPages(state.pages),
  };
}

function classifyOutcome(
  textLen: number,
  summary: BrandWebExploreTechnicalSummary,
  pagesUseful: number,
): {
  outcome: BrandWebExploreOutcome;
  userMessage: string;
  userRecommendation?: string;
  challengeSourceMetadata?: BrandWebExploreChallengeSourceMetadata;
} {
  if (textLen === 0) {
    if (summary.access_limited) {
      return { outcome: "blocked", userMessage: BRAND_WEB_EXPLORE_MSG_BLOCKED };
    }
    if (summary.blocked_by_javascript_or_challenge && summary.challenge_final_url) {
      return {
        outcome: "js_blocked",
        userMessage: BRAND_WEB_EXPLORE_MSG_JS_BLOCKED,
        userRecommendation: BRAND_WEB_EXPLORE_MSG_UI_RECOMMENDATION_JS_BLOCK,
        challengeSourceMetadata: {
          blocked_by_javascript_or_challenge: true,
          detected_blocking_message: (summary.detected_blocking_message ?? "").slice(0, 500),
          entry_url: summary.entry_url,
          final_url: summary.challenge_final_url,
          recommendation: BRAND_WEB_EXPLORE_CHALLENGE_RECOMMENDATION_CODE,
        },
      };
    }
    if (summary.likely_js_shell) {
      return { outcome: "js_shell", userMessage: BRAND_WEB_EXPLORE_MSG_JS_SHELL };
    }
    return { outcome: "failed", userMessage: BRAND_WEB_EXPLORE_MSG_FAILED };
  }
  if (textLen < BRAND_WEB_EXPLORE_LOW_TEXT_CHAR_THRESHOLD) {
    return {
      outcome: "low_text",
      userMessage: summary.likely_js_shell ? BRAND_WEB_EXPLORE_MSG_JS_SHELL : BRAND_WEB_EXPLORE_MSG_LOW_TEXT,
    };
  }
  return {
    outcome: "success",
    userMessage: BRAND_WEB_EXPLORE_MSG_SUCCESS(Math.max(1, pagesUseful)),
  };
}

/**
 * Explora el sitio público de la marca: HTTPS con fallback www/apex, luego HTTP si hace falta.
 * Sin Playwright; sitios solo-JS pueden devolver outcome `failed` / `js_shell` con mensaje claro.
 */
export async function exploreBrandWebsiteControlled(entryUrl: string): Promise<BrandWebExploreControlledResult> {
  const entry = assertPublicExplorableHttpUrl(entryUrl);
  const entryHref = entry.href;

  let allPages: BrandWebExplorePageResult[] = [];
  let best: OriginExploreState | null = null;
  let lastPhase: "https" | "http_fallback" = "https";
  let rememberedChallenge: null | { detectedSnippet: string; finalUrl: string } = null;

  for (const cand of buildHttpsCandidates(entry)) {
    assertPublicExplorableHttpUrl(cand.href);
    const st = await exploreBrandWebsiteFromOrigin(cand, entryHref);
    if (st.lastChallengeBlock) rememberedChallenge = st.lastChallengeBlock;
    allPages = mergePagesUnique(allPages, st.pages);
    if (st.text.trim().length > 0) {
      best = st;
      lastPhase = "https";
      break;
    }
    best = st;
  }

  if (!best || best.text.trim().length === 0) {
    for (const cand of buildHttpFallbackCandidates(entry)) {
      let u: URL;
      try {
        u = assertPublicExplorableHttpUrl(cand.href);
      } catch {
        continue;
      }
      const st = await exploreBrandWebsiteFromOrigin(u, entryHref);
      if (st.lastChallengeBlock) rememberedChallenge = st.lastChallengeBlock;
      allPages = mergePagesUnique(allPages, st.pages);
      if (st.text.trim().length > 0) {
        best = st;
        lastPhase = "http_fallback";
        break;
      }
      best = st;
    }
  }

  const state = best ?? {
    text: "",
    pages: [],
    finalUrls: new Set<string>(),
    failureCodes: new Set<string>(),
    charsBeforeClean: 0,
    charsAfterClean: 0,
    pagesUseful: 0,
    pagesAttempted: 0,
    pagesSucceeded: 0,
    likelyJsShell: false,
    lastChallengeBlock: null,
  };

  const textLen = state.text.trim().length;
  const challengeMeta =
    textLen === 0 ? (state.lastChallengeBlock ?? rememberedChallenge) : null;

  const summary = buildSummary(entryHref, state, lastPhase);
  summary.access_limited = accessLimitedFromPages(allPages.length > 0 ? allPages : state.pages);

  if (challengeMeta) {
    summary.blocked_by_javascript_or_challenge = true;
    summary.detected_blocking_message = challengeMeta.detectedSnippet.slice(0, 500);
    summary.challenge_final_url = challengeMeta.finalUrl;
    summary.recommendation = BRAND_WEB_EXPLORE_CHALLENGE_RECOMMENDATION_CODE;
  }

  const { outcome, userMessage, userRecommendation, challengeSourceMetadata } = classifyOutcome(
    textLen,
    summary,
    state.pagesUseful,
  );

  webExploreLog({
    event: "explore_done",
    entry: entryHref,
    outcome,
    textLen,
    pagesUseful: state.pagesUseful,
    pagesAttempted: state.pagesAttempted,
    protocolPhase: lastPhase,
    jsChallengeBlock: Boolean(challengeMeta),
  });

  return {
    text: state.text,
    pages: allPages.length > 0 ? allPages : state.pages,
    summary,
    outcome,
    userMessage,
    ...(userRecommendation ? { userRecommendation } : {}),
    ...(challengeSourceMetadata ? { challengeSourceMetadata } : {}),
  };
}
