"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTenantId } from "./tenant";
import { getSource } from "./sources";
import { saveSearchResults, updateLead, deleteLead } from "./leads";
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
