import type { LeadSource, FoundCompany } from "./types";

type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
};

function component(p: Place, type: string) {
  return p.addressComponents?.find((c) => c.types.includes(type))?.longText;
}

/** Google Maps über die Places API (New). Braucht GOOGLE_PLACES_API_KEY. */
export const googleSource: LeadSource = {
  id: "google",
  label: "Google Maps",
  description: "Die meisten und aktuellsten Firmen. Braucht einen Google-Schlüssel.",
  costs: "kostenloses Monatskontingent, danach wenige Cent pro Suche",
  availability: () =>
    process.env.GOOGLE_PLACES_API_KEY
      ? { ok: true }
      : { ok: false, reason: "Noch kein Google-Schlüssel eingetragen." },
  async search({ query, location, limit }) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error("Für Google Maps fehlt noch der Schlüssel (GOOGLE_PLACES_API_KEY).");
    const out: FoundCompany[] = [];
    let pageToken: string | undefined;
    while (out.length < limit) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,nextPageToken",
        },
        body: JSON.stringify({
          textQuery: `${query} in ${location}`,
          languageCode: "de",
          regionCode: "DE",
          pageSize: Math.min(20, limit - out.length),
          ...(pageToken ? { pageToken } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Google Maps meldet einen Fehler (${res.status}).`);
      const data = (await res.json()) as { places?: Place[]; nextPageToken?: string };
      for (const p of data.places ?? []) {
        out.push({
          sourceRef: p.id,
          name: p.displayName?.text ?? "Unbekannt",
          industry: p.primaryTypeDisplayName?.text ?? query,
          street: [component(p, "route"), component(p, "street_number")].filter(Boolean).join(" ") || undefined,
          zip: component(p, "postal_code"),
          city: component(p, "locality") ?? location,
          country: component(p, "country"),
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
          website: p.websiteUri,
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken || !data.places?.length) break;
    }
    return out.slice(0, limit);
  },
};
