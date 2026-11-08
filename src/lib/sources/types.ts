/**
 * Gemeinsame Schnittstelle für alle Datenquellen.
 * Eine neue Quelle (z. B. Google Maps, Gelbe Seiten, eigene Liste)
 * muss nur dieses Interface erfüllen und in index.ts eingetragen werden.
 */
export type SearchParams = {
  query: string; // Branche oder Stichwort, z. B. "Zahnarzt"
  location: string; // Ort oder PLZ, z. B. "Berlin" oder "10115"
  limit: number;
  radiusKm?: number; // Umkreis um den Ort in km, 0 oder leer = nur im Ort selbst
};

export type FoundCompany = {
  sourceRef: string; // eindeutige ID in der Quelle, verhindert Duplikate
  name: string;
  industry?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactName?: string;
  contactRole?: string;
};

export type Availability = { ok: true } | { ok: false; reason: string };

export interface LeadSource {
  id: string;
  label: string;
  description: string;
  costs: string;
  availability(): Availability;
  search(params: SearchParams): Promise<FoundCompany[]>;
}
