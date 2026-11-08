export const LEAD_STATUSES = [
  { id: "neu", label: "Neu" },
  { id: "kontaktiert", label: "Kontaktiert" },
  { id: "termin", label: "Termin" },
  { id: "kunde", label: "Kunde" },
  { id: "kein_interesse", label: "Kein Interesse" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];

export function statusLabel(id: string): string {
  return LEAD_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export function isLeadStatus(v: string): v is LeadStatus {
  return LEAD_STATUSES.some((s) => s.id === v);
}
