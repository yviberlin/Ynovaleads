import type { LeadSource, FoundCompany } from "./types";

const UA = "Leadscraper/0.1 (self-hosted lead research tool)";

/** Häufige Branchen auf OpenStreetMap-Kategorien abbilden. */
const INDUSTRY_TAGS: Record<string, string[]> = {
  zahnarzt: ['"amenity"="dentist"', '"healthcare"="dentist"'],
  arzt: ['"amenity"="doctors"', '"healthcare"="doctor"'],
  apotheke: ['"amenity"="pharmacy"'],
  friseur: ['"shop"="hairdresser"'],
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
  kosmetik: ['"shop"="beauty"'],
  blumen: ['"shop"="florist"'],
  optiker: ['"shop"="optician"'],
};

function tagsFor(query: string): string[] {
  const q = query.trim().toLowerCase();
  for (const [key, tags] of Object.entries(INDUSTRY_TAGS)) {
    if (q.includes(key)) return tags;
  }
  // Fallback: nach dem Stichwort im Namen suchen
  const safe = q.replace(/["\\]/g, "");
  return [`"name"~"${safe}",i`];
}

async function geocode(location: string): Promise<[number, number, number, number]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de,at,ch&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de" } });
  if (!res.ok) throw new Error(`Ort konnte nicht gefunden werden (${res.status}).`);
  const data = (await res.json()) as { boundingbox: string[] }[];
  if (!data.length) throw new Error(`Den Ort „${location}“ gibt es auf der Karte nicht.`);
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return [south, west, north, east];
}

export const osmSource: LeadSource = {
  id: "osm",
  label: "OpenStreetMap",
  description: "Freie Weltkarte. Kostenlos, aber nicht jede Firma ist eingetragen.",
  costs: "kostenlos",
  availability: () => ({ ok: true }),
  async search({ query, location, limit }) {
    const [s, w, n, e] = await geocode(location);
    const bbox = `${s},${w},${n},${e}`;
    const parts = tagsFor(query)
      .map((t) => `nwr[${t}](${bbox});`)
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
        city: t["addr:city"] || location,
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
