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
  /** Offene Stellen von der Website (nur gesetzt, wenn danach gesucht wurde) */
  jobs?: JobInfo;
};

export type JobInfo = {
  titles: string[]; // erkannte Stellentitel, z. B. "Steuerfachangestellte (m/w/d)"
  careersUrl?: string; // Karriereseite, falls gefunden
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

const VALID_EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,24}$/i;

export function extractEmails(html: string, text: string): string[] {
  const found = new Set<string>();
  // mailto-Links: oft mit HTML-Entities oder %-Kodierung verschleiert
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    let v = decodeEntities(decodeEntities(m[1]));
    try { v = decodeURIComponent(v); } catch {}
    found.add(v);
  }
  const deobf = text
    .replace(/\s*[\[(]\s*(at|ät)\s*[\])]\s*/gi, "@")
    .replace(/\s+(at)\s+(?=[a-z0-9-]+\s*(\.|[\[(]\s*(dot|punkt)))/gi, "@")
    .replace(/\s*[\[(]\s*(dot|punkt)\s*[\])]\s*/gi, ".");
  for (const m of deobf.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi)) found.add(m[0]);
  return [...found]
    .map((e) => e.trim().replace(/[.,;:]+$/, "").toLowerCase())
    .filter((e) => VALID_EMAIL.test(e) && !BAD_EMAIL.test(e));
}

/** Bevorzugt Adressen der eigenen Domain und allgemeine Postfächer wie info@ oder kontakt@. */
export function pickEmail(emails: string[], website?: string | null): string | undefined {
  if (!emails.length) return undefined;
  let host = "";
  try { host = website ? new URL(website).hostname.replace(/^www\./, "") : ""; } catch {}
  const score = (e: string) => {
    let s = 0;
    const [local = "", domain = ""] = e.split("@");
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

// ---------- Offene Stellen ----------

const CAREER_LINK = /karriere|career|\bjobs?\b|stellen(angebote?|anzeigen|markt|börse)?\b|offene[- ]stellen|wir[- ]suchen|mitarbeiter(in)?[- ]gesucht|join[- ]us|arbeiten[- ]bei|team[- ]verstärkung/i;
const ATS_HOST = /personio\.(de|com)|softgarden\.io|join\.com|recruitee\.com|onlyfy\.jobs|prescreen\.io|smartrecruiters\.com|greenhouse\.io|workable\.com|d\.vinci|dvinci-hr|rexx-systems|concludis|jobs\.ashbyhq/i;
// "(m/w/d)", "(w/m/d)", "(m|w|d)", "(d/m/w)", "(all genders)", "(gn)", "(m/f/d)" …
const GENDER_MARK = /\((?:[mwdfxi]|div)\s*[\/|,]\s*(?:[mwdfxi]|div)(?:\s*[\/|,]\s*(?:[mwdfxi]|div))?\)|\(all genders?\)|\(gn\)/i;
const NO_JOBS = /(derzeit|aktuell|momentan|zurzeit)\s+(\S+\s+){0,3}?(keine|kein)\s+(offenen?\s+)?(stellen|jobs|stellenangebote|vakanzen)/i;

/** Links zur Karriereseite oder zu einem Bewerbungsportal. */
export function findCareerLinks(html: string, base: string): string[] {
  const own: string[] = [];
  const ats: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    const label = htmlToText(m[2]);
    let url: URL;
    try { url = new URL(href, base); } catch { continue; }
    if (ATS_HOST.test(url.hostname)) ats.push(url.toString());
    else if (CAREER_LINK.test(url.pathname + " " + label) && !/datenschutz|privacy|impressum/i.test(url.pathname)) own.push(url.toString());
  }
  return [...new Set([...ats, ...own])];
}

/** Erkennt Stellentitel an der Geschlechterangabe wie "(m/w/d)". */
export function extractJobTitles(html: string): string[] {
  const titles: string[] = [];
  for (const raw of htmlToText(html).split("\n")) {
    const m = raw.match(GENDER_MARK);
    if (!m || m.index === undefined) continue;
    let t = raw.slice(0, m.index + m[0].length).trim();
    // Vorspann wie "Wir suchen eine/n" oder "Stellenangebot:" entfernen
    t = t.replace(/^.*?(wir suchen|suchen wir|zur verstärkung[^:]*?)\s+(ab sofort\s+)?(eine?n?|eine\/n|einen\/eine|eine\/einen)?\s*/i, "");
    t = t.replace(/^(stellenangebot|stellenanzeige|job|neu)\s*[:\-–]\s*/i, "").replace(/\s+/g, " ").trim();
    if (t.length < 5 || t.length > 90 || /datenschutz|cookie|newsletter/i.test(t)) continue;
    titles.push(t);
  }
  const seen = new Set<string>();
  return titles.filter((t) => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 15);
}

export function pageSaysNoJobs(html: string): boolean {
  return NO_JOBS.test(htmlToText(html));
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

/** Sucht die Karriereseite und liest offene Stellen aus. */
async function findJobs(home: { url: string; html: string }): Promise<JobInfo> {
  const titles = extractJobTitles(home.html);
  let careersUrl: string | undefined;
  const candidates = findCareerLinks(home.html, home.url).slice(0, 3);
  for (const c of candidates) {
    const page = await fetchHtml(c);
    if (!page) continue;
    careersUrl ??= page.url;
    const found = extractJobTitles(page.html);
    titles.push(...found);
    // Eigene Karriereseite verweist oft auf ein Bewerbungsportal
    if (!found.length && !pageSaysNoJobs(page.html)) {
      const portal = findCareerLinks(page.html, page.url).find((u) => ATS_HOST.test(new URL(u).hostname));
      const p2 = portal ? await fetchHtml(portal) : undefined;
      if (p2) titles.push(...extractJobTitles(p2.html));
    }
    if (titles.length) break;
  }
  return { titles: [...new Set(titles)].slice(0, 15), careersUrl };
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
  const result = extractFromPages(pages, home.url);
  result.jobs = await findJobs(home);
  return result;
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

/** Holt den sichtbaren Text der Startseite (gekürzt), z. B. als Grundlage für die KI-Bewertung. */
export async function fetchWebsiteText(website: string, maxChars = 4000): Promise<string | undefined> {
  const home = await fetchHtml(normalizeWebsite(website.trim()));
  if (!home) return undefined;
  const title = home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const desc = home.html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim();
  const text = htmlToText(home.html).replace(/\s+/g, " ").trim();
  return [title && `Titel: ${decodeEntities(title)}`, desc && `Beschreibung: ${decodeEntities(desc)}`, text]
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}
