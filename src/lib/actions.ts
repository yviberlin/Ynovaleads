"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTenantId } from "./tenant";
import { getSource } from "./sources";
import { saveSearchResults, updateLead, deleteLead, getLead, applyEnrichment, leadsNeedingEnrichment, parseFilter } from "./leads";
import { enrichWebsite, mapLimit } from "./enrich";
import { isLeadStatus } from "./status";

export type SearchState = { error?: string };

export async function runSearch(_prev: SearchState, form: FormData): Promise<SearchState> {
  const tenantId = await getCurrentTenantId();
  const query = String(form.get("query") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const sourceId = String(form.get("source") ?? "demo");
  const limit = Math.min(Math.max(Number(form.get("limit") ?? 25) || 25, 1), 100);

  if (!query) return { error: "Bitte gib eine Branche oder ein Stichwort ein." };
  if (!location) return { error: "Bitte gib einen Ort oder eine Postleitzahl ein." };

  const source = getSource(sourceId);
  if (!source) return { error: "Diese Datenquelle gibt es nicht." };
  const avail = source.availability();
  if (!avail.ok) return { error: `${source.label}: ${avail.reason}` };

  let result;
  try {
    const companies = await source.search({ query, location, limit });
    result = saveSearchResults(tenantId, { query, location, source: source.id }, companies);
    if (form.get("enrich") === "1" && source.id !== "demo") {
      await enrichLeads(tenantId, leadsNeedingEnrichment(tenantId, { searchId: result.searchId }, limit));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (!msg || msg === "fetch failed") {
      return { error: `${source.label} ist gerade nicht erreichbar. Bitte prüfe deine Internetverbindung und versuch es nochmal.` };
    }
    return { error: msg };
  }
  revalidatePath("/");
  revalidatePath("/leads");
  redirect(`/leads?suche=${result.searchId}&neu=${result.added}&gefunden=${result.found}`);
}

export async function setLeadStatus(id: number, status: string) {
  if (!isLeadStatus(status)) return;
  const tenantId = await getCurrentTenantId();
  updateLead(tenantId, id, { status });
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function saveNotes(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = Number(form.get("id"));
  updateLead(tenantId, id, { notes: String(form.get("notes") ?? "") });
  revalidatePath(`/leads/${id}`);
}

export async function removeLead(form: FormData) {
  const tenantId = await getCurrentTenantId();
  deleteLead(tenantId, Number(form.get("id")));
  revalidatePath("/");
  revalidatePath("/leads");
  redirect("/leads");
}

const ENRICH_BATCH = 40;

async function enrichLeads(tenantId: string, leads: { id: number; website: string | null }[]) {
  let improved = 0;
  await mapLimit(leads, 5, async (l) => {
    const e = l.website ? await enrichWebsite(l.website) : undefined;
    applyEnrichment(tenantId, l.id, e);
    if (e && (e.email || e.contactName || e.phone)) improved++;
  });
  return improved;
}

/** Liest Website und Impressum eines einzelnen Leads aus. */
export async function enrichOne(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = Number(form.get("id"));
  const lead = getLead(tenantId, id);
  if (lead?.website) applyEnrichment(tenantId, id, await enrichWebsite(lead.website));
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/");
}

/** Ergänzt fehlende Daten für die aktuell gefilterten Leads (höchstens 40 auf einmal). */
export async function enrichFiltered(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const qs = String(form.get("qs") ?? "");
  const f = parseFilter(Object.fromEntries(new URLSearchParams(qs).entries()));
  const todo = leadsNeedingEnrichment(tenantId, f, ENRICH_BATCH);
  const improved = await enrichLeads(tenantId, todo);
  revalidatePath("/");
  revalidatePath("/leads");
  const p = new URLSearchParams(qs);
  p.set("ergaenzt", String(improved));
  p.set("geprueft", String(todo.length));
  redirect(`/leads?${p.toString()}`);
}
