import { getDb } from "./db";

export function getSetting(tenantId: string, key: string): string | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE tenant_id = ? AND key = ?").get(tenantId, key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(tenantId: string, key: string, value: string) {
  getDb()
    .prepare(`INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`)
    .run(tenantId, key, value);
}

/** Beschreibt, welche Firmen gut zum eigenen Angebot passen. Grundlage der KI-Bewertung. */
export type CustomerProfile = {
  angebot: string;
  zielkunden: string;
  region: string;
  gutesZeichen: string;
  ausschluss: string;
};

export const DEFAULT_PROFILE: CustomerProfile = {
  angebot: "Design und Branding: Logos, Corporate Design, Websites und Werbemittel für kleine und mittlere Unternehmen.",
  zielkunden: "Inhabergeführte Firmen und Kanzleien mit 3 bis 50 Mitarbeitenden, z. B. Steuerberater, Ärzte, Handwerk, Dienstleister.",
  region: "Deutschland, Österreich, Schweiz",
  gutesZeichen: "Veraltete oder keine Website, uneinheitlicher Auftritt, Firma wächst oder hat neu eröffnet, Ansprechpartner namentlich bekannt.",
  ausschluss: "Große Konzerne und Ketten, Behörden, Vereine ohne Budget, Firmen mit sehr moderner, professioneller Website.",
};

const KEY = "kundenprofil";

export function getProfile(tenantId: string): CustomerProfile & { saved: boolean } {
  const raw = getSetting(tenantId, KEY);
  if (!raw) return { ...DEFAULT_PROFILE, saved: false };
  try {
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<CustomerProfile>), saved: true };
  } catch {
    return { ...DEFAULT_PROFILE, saved: false };
  }
}

export function saveProfile(tenantId: string, p: CustomerProfile) {
  setSetting(tenantId, KEY, JSON.stringify(p));
}
