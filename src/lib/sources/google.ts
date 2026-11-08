import type { LeadSource, FoundCompany } from "./types";
import { circleBox, distanceKm, geocode, MAX_RADIUS_KM } from "./geo";

type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
  location?: { latitude: number; longitude: number };
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
  async search({ query, location, limit, radiusKm }) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error("Für Google Maps fehlt noch der Schlüssel (GOOGLE_PLACES_API_KEY).");
    // Umkreis: Ortsmitte bestimmen, Google auf das Gebiet beschränken, dann genau nach Entfernung filtern
    const radius = Math.min(radiusKm ?? 0, MAX_RADIUS_KM);
    const center = radius > 0 ? await geocode(location) : undefined;
    const area = center
      ? (() => {
          const b = circleBox(center.lat, center.lon, radius);
          return { locationRestriction: { rectangle: { low: { latitude: b.south, longitude: b.west }, high: { latitude: b.north, longitude: b.east } } } };
        })()
      : {};
    const out: FoundCompany[] = [];
    let pageToken: string | undefined;
    while (out.length < limit) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.location,nextPageToken",
        },
        body: JSON.stringify({
          textQuery: center ? query : `${query} in ${location}`,
          ...area,
          languageCode: "de",
          regionCode: "DE",
          pageSize: Math.min(20, limit - out.length),
          ...(pageToken ? { pageToken } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Google Maps meldet einen Fehler (${res.status}).`);
      const data = (await res.json()) as { places?: Place[]; nextPageToken?: string };
      for (const p of data.places ?? []) {
        if (center && p.location && distanceKm(center.lat, center.lon, p.location.latitude, p.location.longitude) > radius) continue;
        out.push({
          sourceRef: p.id,
          name: p.displayName?.text ?? "Unbekannt",
          industry: p.primaryTypeDisplayName?.text ?? query,
          street: [component(p, "route"), component(p, "street_number")].filter(Boolean).join(" ") || undefined,
          zip: component(p, "postal_code"),
          city: component(p, "locality") ?? (center ? undefined : location),
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
