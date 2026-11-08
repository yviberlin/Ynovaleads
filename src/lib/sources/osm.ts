import type { LeadSource, FoundCompany } from "./types";
import { geocode, MAX_RADIUS_KM } from "./geo";

const UA = "Leadscraper/0.1 (self-hosted lead research tool)";

/** Häufige Branchen auf OpenStreetMap-Kategorien abbilden. */
const INDUSTRY_TAGS: Record<string, string[]> = {
  zahnarzt: ['"amenity"="dentist"', '"healthcare"="dentist"'],
  arzt: ['"amenity"="doctors"', '"healthcare"="doctor"'],
  apotheke: ['"amenity"="pharmacy"'],
  friseur: ['"shop"="hairdresser"'],
  frisör: ['"shop"="hairdresser"'],
  restaurant: ['"amenity"="restaurant"'],
  cafe: ['"amenity"="cafe"'],
  hotel: ['"tourism"="hotel"'],
  steuerberater: ['"office"="tax_advisor"'],
  rechtsanwalt: ['"office"="lawyer"'],
  anwalt: ['"office"="lawyer"'],
  immobilien: ['"office"="estate_agent"'],
  makler: ['"office"="estate_agent"'],
  versicherung: ['"office"="insurance"'],
  architekt: ['"office"="architect"'],
  autohaus: ['"shop"="car"'],
  werkstatt: ['"shop"="car_repair"'],
  kfz: ['"shop"="car_repair"'],
  elektriker: ['"craft"="electrician"'],
  maler: ['"craft"="painter"'],
  tischler: ['"craft"="carpenter"'],
  schreiner: ['"craft"="carpenter"'],
  dachdecker: ['"craft"="roofer"'],
  sanitär: ['"craft"="plumber"'],
  klempner: ['"craft"="plumber"'],
  bäckerei: ['"shop"="bakery"'],
  fitness: ['"leisure"="fitness_centre"'],
  physiotherapie: ['"healthcare"="physiotherapist"'],
  physio: ['"healthcare"="physiotherapist"'],
  steuerbüro: ['"office"="tax_advisor"'],
  kosmetik: ['"shop"="beauty"'],
  blumen: ['"shop"="florist"'],
  optiker: ['"shop"="optician"'],
};

/** Bekannte Branchen, z. B. für Vorschläge im Suchfeld */
export const KNOWN_INDUSTRIES = Object.keys(INDUSTRY_TAGS).map((k) => k[0].toUpperCase() + k.slice(1));

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Findet die Branche, auch mit kleinen Tippfehlern („Stuerberater“ → steuerberater). */
export function matchIndustry(query: string): string | undefined {
  const q = query.trim().toLowerCase();
  for (const key of Object.keys(INDUSTRY_TAGS)) if (q.includes(key)) return key;
  let best: { key: string; d: number } | undefined;
  for (const word of q.split(/[\s,/-]+/).filter((w) => w.length >= 4)) {
    for (const key of Object.keys(INDUSTRY_TAGS)) {
      const d = distance(word, key);
      const allowed = key.length >= 8 ? 2 : 1;
      if (d <= allowed && (!best || d < best.d)) best = { key, d };
    }
  }
  return best?.key;
}

function tagsFor(query: string): string[] {
  const q = query.trim().toLowerCase();
  const key = matchIndustry(q);
  if (key) return INDUSTRY_TAGS[key];
  // Fallback: nach dem Stichwort im Namen suchen
  const safe = q.replace(/["\\]/g, "");
  return [`"name"~"${safe}",i`];
}

export const osmSource: LeadSource = {
  id: "osm",
  label: "OpenStreetMap",
  description: "Freie Weltkarte. Kostenlos, aber nicht jede Firma ist eingetragen.",
  costs: "kostenlos",
  availability: () => ({ ok: true }),
  async search({ query, location, limit, radiusKm }) {
    const place = await geocode(location);
    const radius = Math.min(radiusKm ?? 0, MAX_RADIUS_KM);
    // Ohne Umkreis: Rechteck um den Ort. Mit Umkreis: Kreis um die Ortsmitte.
    const area = radius > 0
      ? `around:${Math.round(radius * 1000)},${place.lat},${place.lon}`
      : place.bbox.join(",");
    const parts = tagsFor(query)
      .map((t) => `nwr[${t}](${area});`)
      .join("\n");
    const ql = `[out:json][timeout:25];(${parts});out center tags ${Math.max(limit * 2, 20)};`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(ql),
    });
    if (!res.ok) throw new Error(`OpenStreetMap antwortet gerade nicht (${res.status}). Bitte später nochmal versuchen.`);
    const data = (await res.json()) as {
      elements: { type: string; id: number; tags?: Record<string, string> }[];
    };
    const out: FoundCompany[] = [];
    for (const el of data.elements) {
      const t = el.tags ?? {};
      if (!t.name) continue;
      out.push({
        sourceRef: `${el.type}/${el.id}`,
        name: t.name,
        industry: query.trim(),
        street: [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") || undefined,
        zip: t["addr:postcode"],
        city: t["addr:city"] || (radius > 0 ? undefined : location),
        country: t["addr:country"],
        phone: t.phone || t["contact:phone"],
        email: t.email || t["contact:email"],
        website: t.website || t["contact:website"],
      });
      if (out.length >= limit) break;
    }
    return out;
  },
};
