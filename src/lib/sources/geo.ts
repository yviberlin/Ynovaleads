/** Ort auf der Karte finden (OpenStreetMap Nominatim, kostenlos) und Abstände berechnen. */

const UA = "Leadscraper/0.1 (self-hosted lead research tool)";

export type Place = {
  lat: number;
  lon: number;
  /** Rechteck rund um den Ort: Süd, West, Nord, Ost */
  bbox: [number, number, number, number];
};

export const MAX_RADIUS_KM = 50;

export async function geocode(location: string): Promise<Place> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de,at,ch&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de" } });
  if (!res.ok) throw new Error(`Ort konnte nicht gefunden werden (${res.status}).`);
  const data = (await res.json()) as { lat: string; lon: string; boundingbox: string[] }[];
  if (!data.length) throw new Error(`Den Ort „${location}“ gibt es auf der Karte nicht.`);
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), bbox: [south, west, north, east] };
}

/** Rechteck, das einen Kreis mit radiusKm um den Punkt umschließt. */
export function circleBox(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon };
}

/** Luftlinie in Kilometern. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
