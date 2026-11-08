import { demoSource } from "./demo";
import { osmSource } from "./osm";
import { googleSource } from "./google";
import type { LeadSource } from "./types";

/** Alle verfügbaren Datenquellen. Neue Quelle = hier eintragen. */
export const SOURCES: LeadSource[] = [osmSource, googleSource, demoSource];

export function getSource(id: string): LeadSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function defaultSourceId(): string {
  return SOURCES.find((s) => s.availability().ok)?.id ?? "demo";
}

export type { LeadSource, FoundCompany, SearchParams } from "./types";
