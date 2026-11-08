import type { LeadSource, FoundCompany } from "./types";

const PREFIXES = ["Müller", "Schmidt", "Weber", "Becker", "Hoffmann", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Braun"];
const FIRST = ["Anna", "Thomas", "Sabine", "Michael", "Julia", "Stefan", "Katrin", "Andreas", "Laura", "Markus"];
const STREETS = ["Hauptstraße", "Bahnhofstraße", "Gartenweg", "Lindenallee", "Schillerstraße", "Marktplatz", "Kirchgasse"];

function slug(s: string) {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Erzeugt Beispiel-Firmen, damit man die App ohne Internet und ohne Kosten testen kann. */
export const demoSource: LeadSource = {
  id: "demo",
  label: "Beispieldaten",
  description: "Erfundene Firmen zum Ausprobieren. Keine echten Kontakte.",
  costs: "kostenlos",
  availability: () => ({ ok: true }),
  async search({ query, location, limit }) {
    const out: FoundCompany[] = [];
    const city = location.trim() || "Berlin";
    for (let i = 0; i < limit; i++) {
      const h = hash(`${query}|${city}|${i}`);
      const owner = PREFIXES[h % PREFIXES.length];
      const name = `${query.trim() || "Firma"} ${owner}${i % 3 === 0 ? " GmbH" : ""}`;
      const domain = `${slug(query)}-${slug(owner)}-${i + 1}.example`;
      out.push({
        sourceRef: `demo-${slug(query)}-${slug(city)}-${i}`,
        name,
        industry: query.trim(),
        street: `${STREETS[h % STREETS.length]} ${(h % 120) + 1}`,
        zip: String(10000 + (h % 89999)).padStart(5, "0"),
        city,
        country: "DE",
        phone: `+49 ${30 + (h % 60)} ${100000 + (h % 899999)}`,
        email: `info@${domain}`,
        website: `https://www.${domain}`,
        contactName: h % 4 === 0 ? undefined : `${FIRST[h % FIRST.length]} ${owner}`,
        contactRole: h % 4 === 0 ? undefined : "Geschäftsführung",
      });
    }
    return out;
  },
};
