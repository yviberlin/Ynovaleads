/**
 * Liest Website und Impressum einer Firma und holt fehlende Kontaktdaten heraus:
 * E-Mail, Telefon und Geschäftsführer bzw. Inhaber.
 */

const UA = "Mozilla/5.0 (compatible; Ynovaleads/0.1; +https://github.com/yviberlin/ynovaleads)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

export type Enrichment = {
  email?: string;
  phone?: string;
  contactName?: string;
  contactRole?: string;
  impressumUrl?: string;
};

// ---------- Hilfsfunktionen (rein, ohne Netzwerk, daher gut testbar) ----------

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|address|td|dd|dt)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const BAD_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|@(example\.|sentry|wixpress|domain\.|email\.|ihre-?domain|beispiel)|^(name|max\.mustermann|vorname)@/i;

export function extractEmails(html: string, text: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]));
  const deobf = text
    .replace(/\s*[\[(]\s*(at|ät)\s*[\])]\s*/gi, "@")
    .replace(/\s+(at)\s+(?=[a-z0-9-]+\s*(\.|[\[(]\s*(dot|punkt)))/gi, "@")
    .replace(/\s*[\[(]\s*(dot|punkt)\s*[\])]\s*/gi, ".");
  for (const m of deobf.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi)) found.add(m[0]);
  return [...found]
    .map((e) => e.trim().replace(/[.,;:]+$/, "").toLowerCase())
    .filter((e) => !BAD_EMAIL.test(e));
}

/** Bevorzugt Adressen der eigenen Domain und allgemeine Postfächer wie info@ oder kontakt@. */
export function pickEmail(emails: string[], website?: string | null): string | undefined {
  if (!emails.length) return undefined;
  let host = "";
  try { host = website ? new URL(website).hostname.replace(/^www\./, "") : ""; } catch {}
  const score = (e: string) => {
    let s = 0;
    const [local, domain] = e.split("@");
    if (host && (domain === host || domain.endsWith("." + host) || host.endsWith("." + domain))) s += 10;
    if (/^(info|kontakt|contact|office|mail|hallo|hello|praxis|kanzlei|service|post)$/.test(local)) s += 5;
    if (/^(datenschutz|privacy|dsb|noreply|no-reply|webmaster|abuse)/.test(local)) s -= 8;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

export function extractPhone(text: string): string | undefined {
  const m = text.match(/(?:Tel(?:efon)?|Fon|Phone|T)\.?\s*[:.]?\s*((?:\+|00)?[\d][\d\s\/().-]{6,22}\d)/i);
  if (!m) return undefined;
  const digits = m[1].replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 16) return undefined;
  return m[1].replace(/\s+/g, " ").trim();
}

const TITLE = "(?:(?:Dr|Prof|Dipl|Mag)\\.(?:-[A-Za-z]+\\.?)?(?: *(?:med|dent|rer|nat|jur|phil|oec|vet|pol|habil|h\\. ?c)\\.)* +)*";
const WORD = "[A-ZÄÖÜ][a-zäöüßéèáàó]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?";
// Nur Leerzeichen zwischen den Namensteilen, damit keine Zeilenumbrüche mitgenommen werden
const NAME = `(${TITLE}${WORD}(?: +(?:von|van|de|zu))?(?: +${WORD}){1,2})`;
const SEP = "\\s*(?:\\([a-z]*\\))?\\s*[:\\-–]?\\s*";
const ROLES: [RegExp, string][] = [
  [new RegExp(`Geschäftsführer(?:in)?${SEP}${NAME}`), "Geschäftsführung"],
  [new RegExp(`Geschäftsführung${SEP}${NAME}`), "Geschäftsführung"],
  [new RegExp(`[Vv]ertreten durch(?: (?:den|die) (?:Geschäftsführer(?:in)?|Inhaber(?:in)?|Vorstand))?${SEP}${NAME}`), "Geschäftsführung"],
  [new RegExp(`Inhaber(?:in)?${SEP}${NAME}`), "Inhaber"],
  [new RegExp(`Vorstand${SEP}${NAME}`), "Vorstand"],
];
const NOT_A_NAME = /^(Der|Die|Das|Den|Dem|Und|Sowie|Gesellschaft|Geschäftsführer|Amtsgericht|Registergericht|Handelsregister|Sitz|Telefon|Herr|Frau|Inhaber)\b/;

export function extractContact(text: string): { name: string; role: string } | undefined {
  const t = text.replace(/\b(Herrn?|Frau) +/g, "");
  for (const [re, role] of ROLES) {
    const m = t.match(re);
    if (m && m[1] && !NOT_A_NAME.test(m[1])) return { name: m[1].trim(), role };
  }
  return undefined;
}

export function findImpressumLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const label = htmlToText(m[2]).toLowerCase();
    if (/impressum|imprint|legal[- ]?notice|anbieterkennzeichnung/i.test(href + " " + label)) {
      try { out.push(new URL(href, base).toString()); } catch {}
    }
  }
  return [...new Set(out)];
}

/** Wertet eine oder mehrere Seiten aus. Spätere Seiten (Impressum) haben Vorrang. */
export function extractFromPages(pages: { url: string; html: string }[], website?: string | null): Enrichment {
  const result: Enrichment = {};
  const allEmails: string[] = [];
  for (const p of [...pages].reverse()) {
    const text = htmlToText(p.html);
    allEmails.push(...extractEmails(p.html, text));
    if (!result.phone) result.phone = extractPhone(text);
    if (!result.contactName) {
      const c = extractContact(text);
      if (c) { result.contactName = c.name; result.contactRole = c.role; }
    }
  }
  result.email = pickEmail(allEmails, website);
  const imp = pages.find((p) => /impressum|imprint/i.test(p.url));
  if (imp) result.impressumUrl = imp.url;
  return result;
}

// ---------- Netzwerk ----------

function isPublicHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    const h = url.hostname;
    return !(h === "localhost" || h.endsWith(".local") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(h));
  } catch {
    return false;
  }
}

async function fetchHtml(url: string): Promise<{ url: string; html: string } | undefined> {
  if (!isPublicHttpUrl(url)) return undefined;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "de,en;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "text/html").includes("html")) return undefined;
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8").decode(buf.slice(0, MAX_BYTES));
    return { url: res.url || url, html };
  } catch {
    return undefined;
  }
}

function normalizeWebsite(w: string): string {
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export async function enrichWebsite(website: string): Promise<Enrichment | undefined> {
  const start = normalizeWebsite(website.trim());
  const home = await fetchHtml(start);
  if (!home) return undefined;
  const pages = [home];
  const candidates = findImpressumLinks(home.html, home.url);
  if (!candidates.length) {
    const origin = new URL(home.url).origin;
    candidates.push(`${origin}/impressum`, `${origin}/impressum/`, `${origin}/impressum.html`, `${origin}/imprint`);
  }
  for (const c of candidates.slice(0, 4)) {
    const page = await fetchHtml(c);
    if (page && /impressum|imprint|angaben gemäß|§\s*5\s*(tmg|ddg)/i.test(page.html)) {
      pages.push(page);
      break;
    }
  }
  return extractFromPages(pages, home.url);
}

/** Führt Aufgaben mit begrenzter Parallelität aus, damit Websites nicht überlastet werden. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
