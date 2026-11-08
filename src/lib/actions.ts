"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTenantId } from "./tenant";
import { getSource } from "./sources";
import { saveSearchResults, updateLead, deleteLead, getLead, applyEnrichment, leadsNeedingEnrichment, parseFilter, setStatusForIds, listLeadsByIds, markInObsidian, saveScore, leadsWithoutScore, type Lead } from "./leads";
import { enrichWebsite, fetchWebsiteText, mapLimit } from "./enrich";
import { aiAvailable, friendlyAiError, scoreLead } from "./score";
import { getProfile, saveProfile } from "./settings";
import { writeLeadsToObsidian } from "./obsidian";
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

/** Setzt den Status für alle ausgewählten Leads. */
export async function setStatusForSelected(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const status = String(form.get("bulkStatus") ?? "");
  const ids = form.getAll("id").map(Number);
  if (isLeadStatus(status)) setStatusForIds(tenantId, ids, status);
  revalidatePath("/");
  revalidatePath("/leads");
}

/** Schreibt die ausgewählten Leads als Notizen in die Obsidian-Kommandozentrale. */
export async function sendSelectedToObsidian(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const ids = form.getAll("id").map(Number);
  const back = new URLSearchParams(String(form.get("qs") ?? ""));
  try {
    const leads = listLeadsByIds(tenantId, ids);
    const r = writeLeadsToObsidian(leads);
    markInObsidian(tenantId, leads.map((l) => l.id));
    back.set("obsidian", String(r.written));
    if (r.skipped) back.set("obsidianDa", String(r.skipped));
  } catch (e) {
    back.set("obsidianFehler", e instanceof Error ? e.message : "Übertragung fehlgeschlagen.");
  }
  revalidatePath("/leads");
  redirect(`/leads?${back.toString()}`);
}

// ---------- KI-Bewertung ----------

const SCORE_BATCH = 25;

async function scoreLeads(tenantId: string, leads: Lead[]): Promise<{ done: number; error?: string }> {
  const avail = aiAvailable();
  if (!avail.ok) return { done: 0, error: avail.reason };
  const profile = getProfile(tenantId);
  let done = 0;
  let error: string | undefined;
  await mapLimit(leads, 4, async (l) => {
    if (error) return;
    try {
      const text = l.website ? await fetchWebsiteText(l.website) : undefined;
      const r = await scoreLead(l, profile, text);
      saveScore(tenantId, l.id, r.score, r.reason);
      done++;
    } catch (e) {
      error = friendlyAiError(e);
    }
  });
  return { done, error };
}

function backToList(qs: string, r: { done: number; error?: string }, extra: Record<string, string> = {}) {
  const p = new URLSearchParams(qs);
  p.set("bewertet", String(r.done));
  if (r.error) p.set("bewertungFehler", r.error);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  revalidatePath("/");
  revalidatePath("/leads");
  redirect(`/leads?${p.toString()}`);
}

/** Bewertet einen einzelnen Lead (auch neu, wenn er schon bewertet war). */
export async function scoreOne(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const id = Number(form.get("id"));
  const lead = getLead(tenantId, id);
  const r = lead ? await scoreLeads(tenantId, [lead]) : { done: 0 };
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  if (r.error) redirect(`/leads/${id}?bewertungFehler=${encodeURIComponent(r.error)}`);
}

/** Bewertet die angehakten Leads. */
export async function scoreSelected(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const ids = form.getAll("id").map(Number).slice(0, 100);
  const r = await scoreLeads(tenantId, listLeadsByIds(tenantId, ids));
  backToList(String(form.get("qs") ?? ""), r);
}

/** Bewertet die gefilterten Leads, die noch keine Bewertung haben (höchstens 25 auf einmal). */
export async function scoreFiltered(form: FormData) {
  const tenantId = await getCurrentTenantId();
  const qs = String(form.get("qs") ?? "");
  const f = parseFilter(Object.fromEntries(new URLSearchParams(qs).entries()));
  const todo = leadsWithoutScore(tenantId, f, SCORE_BATCH);
  const r = await scoreLeads(tenantId, todo);
  backToList(qs, r, { offen: String(todo.length === SCORE_BATCH ? 1 : 0) });
}

export type ProfileState = { saved?: boolean; error?: string };

export async function saveCustomerProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const tenantId = await getCurrentTenantId();
  const get = (k: string) => String(form.get(k) ?? "").trim().slice(0, 2000);
  const p = { angebot: get("angebot"), zielkunden: get("zielkunden"), region: get("region"), gutesZeichen: get("gutesZeichen"), ausschluss: get("ausschluss") };
  if (!p.angebot) return { error: "Bitte beschreib kurz, was du anbietest." };
  saveProfile(tenantId, p);
  revalidatePath("/einstellungen");
  return { saved: true };
}
