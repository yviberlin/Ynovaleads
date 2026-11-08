import type { Lead } from "./leads";
import { statusLabel } from "./status";

const COLUMNS: [keyof Lead, string][] = [
  ["name", "Firma"],
  ["industry", "Branche"],
  ["contact_name", "Ansprechpartner"],
  ["contact_role", "Position"],
  ["email", "E-Mail"],
  ["phone", "Telefon"],
  ["website", "Website"],
  ["street", "Straße"],
  ["zip", "PLZ"],
  ["city", "Ort"],
  ["status", "Status"],
  ["score", "Bewertung"],
  ["score_reason", "Begründung"],
  ["notes", "Notizen"],
  ["created_at", "Gefunden am"],
];

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV mit Semikolon und BOM, damit Excel in Deutschland Umlaute und Spalten richtig erkennt. */
export function leadsToCsv(leads: Lead[]): string {
  const head = COLUMNS.map(([, label]) => label).join(";");
  const rows = leads.map((l) =>
    COLUMNS.map(([key]) => cell(key === "status" ? statusLabel(l.status) : l[key])).join(";")
  );
  return "﻿" + [head, ...rows].join("\r\n");
}
