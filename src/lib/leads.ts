import { getDb } from "./db";
import type { FoundCompany } from "./sources";
import type { LeadStatus } from "./status";
import type { Enrichment } from "./enrich";

export type Lead = {
  id: number;
  tenant_id: string;
  search_id: number | null;
  source: string;
  source_ref: string | null;
  name: string;
  industry: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  contact_role: string | null;
  status: string;
  score: number | null;
  notes: string | null;
  impressum_url: string | null;
  enriched_at: string | null;
  obsidian_at: string | null;
  score_reason: string | null;
  hiring: number | null; // 1 = Stellen auf der Website gefunden
  careers_url: string | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Search = {
  id: number;
  query: string;
  location: string;
  source: string;
  found: number;
  added: number;
  created_at: string;
};

export type LeadFilter = {
  q?: string;
  status?: string;
  city?: string;
  industry?: string;
  hasEmail?: boolean;
  hasContact?: boolean;
  searchId?: number;
  minScore?: number;
  sort?: "neu" | "bewertung";
};

function where(tenantId: string, f: LeadFilter) {
  const clauses = ["tenant_id = ?"];
  const args: (string | number)[] = [tenantId];
  if (f.q) {
    clauses.push("(name LIKE ? OR email LIKE ? OR contact_name LIKE ? OR website LIKE ?)");
    const like = `%${f.q}%`;
    args.push(like, like, like, like);
  }
  if (f.status) { clauses.push("status = ?"); args.push(f.status); }
  if (f.city) { clauses.push("city = ?"); args.push(f.city); }
  if (f.industry) { clauses.push("industry = ?"); args.push(f.industry); }
  if (f.searchId) { clauses.push("search_id = ?"); args.push(f.searchId); }
  if (f.minScore) { clauses.push("score >= ?"); args.push(f.minScore); }
  if (f.hasEmail) clauses.push("email IS NOT NULL AND email <> ''");
  if (f.hasContact) clauses.push("contact_name IS NOT NULL AND contact_name <> ''");
  return { sql: clauses.join(" AND "), args };
}

/** Neueste Suche zuerst, innerhalb einer Suche in der Reihenfolge der Quelle (bei Google: Relevanz). */
const ORDER_NEWEST = "COALESCE(search_id, 0) DESC, id ASC";

export function listLeads(tenantId: string, f: LeadFilter = {}, limit = 500): Lead[] {
  const w = where(tenantId, f);
  return getDb()
    .prepare(`SELECT * FROM leads WHERE ${w.sql} ORDER BY ${f.sort === "bewertung" ? "score IS NULL, score DESC, " : "COALESCE(hiring, 0) DESC, "}${ORDER_NEWEST} LIMIT ?`)
    .all(...w.args, limit) as unknown as Lead[];
}

export function countLeads(tenantId: string, f: LeadFilter = {}): number {
  const w = where(tenantId, f);
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${w.sql}`).get(...w.args) as { n: number };
  return row.n;
}

export function getLead(tenantId: string, id: number): Lead | undefined {
  return getDb().prepare("SELECT * FROM leads WHERE tenant_id = ? AND id = ?").get(tenantId, id) as unknown as Lead | undefined;
}

export function updateLead(
  tenantId: string,
  id: number,
  patch: { status?: LeadStatus; notes?: string }
) {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.status !== undefined) { sets.push("status = ?"); args.push(patch.status); }
  if (patch.notes !== undefined) { sets.push("notes = ?"); args.push(patch.notes); }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  getDb()
    .prepare(`UPDATE leads SET ${sets.join(", ")} WHERE tenant_id = ? AND id = ?`)
    .run(...args, tenantId, id);
}

export function deleteLead(tenantId: string, id: number) {
  getDb().prepare("DELETE FROM leads WHERE tenant_id = ? AND id = ?").run(tenantId, id);
}

export function distinctValues(tenantId: string, column: "city" | "industry"): string[] {
  const rows = getDb()
    .prepare(`SELECT DISTINCT ${column} AS v FROM leads WHERE tenant_id = ? AND ${column} IS NOT NULL AND ${column} <> '' ORDER BY v`)
    .all(tenantId) as { v: string }[];
  return rows.map((r) => r.v);
}

export function statusCounts(tenantId: string): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT status, COUNT(*) AS n FROM leads WHERE tenant_id = ? GROUP BY status")
    .all(tenantId) as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export function dataQuality(tenantId: string) {
  return getDb()
    .prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS withEmail,
      SUM(CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 ELSE 0 END) AS withPhone,
      SUM(CASE WHEN website IS NOT NULL AND website <> '' THEN 1 ELSE 0 END) AS withWebsite,
      SUM(CASE WHEN contact_name IS NOT NULL AND contact_name <> '' THEN 1 ELSE 0 END) AS withContact
    FROM leads WHERE tenant_id = ?`)
    .get(tenantId) as { total: number; withEmail: number; withPhone: number; withWebsite: number; withContact: number };
}

export function recentSearches(tenantId: string, limit = 8): Search[] {
  return getDb()
    .prepare("SELECT id, query, location, source, found, added, created_at FROM searches WHERE tenant_id = ? ORDER BY id DESC LIMIT ?")
    .all(tenantId, limit) as unknown as Search[];
}

/** Speichert eine Suche und ihre Treffer. Bereits vorhandene Firmen werden übersprungen. */
export function saveSearchResults(
  tenantId: string,
  search: { query: string; location: string; source: string },
  companies: FoundCompany[]
): { searchId: number; found: number; added: number } {
  const db = getDb();
  const s = db
    .prepare("INSERT INTO searches (tenant_id, query, location, source, found) VALUES (?, ?, ?, ?, ?)")
    .run(tenantId, search.query, search.location, search.source, companies.length);
  const searchId = Number(s.lastInsertRowid);
  const insert = db.prepare(`INSERT OR IGNORE INTO leads
    (tenant_id, search_id, source, source_ref, name, industry, street, zip, city, country, phone, email, website, contact_name, contact_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const moveToSearch = db.prepare("UPDATE leads SET search_id = ? WHERE tenant_id = ? AND source = ? AND source_ref = ?");
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const c of companies) {
      const r = insert.run(
        tenantId, searchId, search.source, c.sourceRef, c.name,
        c.industry ?? null, c.street ?? null, c.zip ?? null, c.city ?? null, c.country ?? null,
        c.phone ?? null, c.email ?? null, c.website ?? null, c.contactName ?? null, c.contactRole ?? null
      );
      if (Number(r.changes)) added++;
      // Schon vorhandene Firma: der neuesten Suche zuordnen, damit sie in deren Trefferliste auftaucht
      else if (c.sourceRef) moveToSearch.run(searchId, tenantId, search.source, c.sourceRef);
    }
    db.prepare("UPDATE searches SET added = ? WHERE id = ?").run(added, searchId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { searchId, found: companies.length, added };
}

export function parseFilter(sp: Record<string, string | string[] | undefined>): LeadFilter {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.trim() || undefined; };
  const sid = Number(one("suche"));
  const min = Number(one("punkte"));
  return {
    q: one("q"),
    status: one("status"),
    city: one("ort"),
    industry: one("branche"),
    hasEmail: one("email") === "1",
    hasContact: one("kontakt") === "1",
    searchId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
    minScore: Number.isInteger(min) && min >= 1 && min <= 10 ? min : undefined,
    sort: one("sortierung") === "bewertung" ? "bewertung" : undefined,
  };
}

function hiringFlag(e: Enrichment | undefined): number | null {
  if (!e?.jobs) return null;
  return e.jobs.titles.length ? 1 : 0;
}

/** Trägt gefundene Daten ein, überschreibt aber nichts, was schon da ist. */
export function applyEnrichment(tenantId: string, id: number, e: Enrichment | undefined) {
  getDb()
    .prepare(`UPDATE leads SET
      email = COALESCE(NULLIF(email, ''), ?),
      phone = COALESCE(NULLIF(phone, ''), ?),
      contact_name = COALESCE(NULLIF(contact_name, ''), ?),
      contact_role = CASE WHEN contact_name IS NULL OR contact_name = '' THEN ? ELSE contact_role END,
      impressum_url = COALESCE(?, impressum_url),
      hiring = CASE WHEN ? IS NULL THEN hiring ELSE ? END,
      careers_url = COALESCE(?, careers_url),
      enriched_at = datetime('now'),
      updated_at = datetime('now')
    WHERE tenant_id = ? AND id = ?`)
    .run(
      e?.email ?? null, e?.phone ?? null, e?.contactName ?? null, e?.contactRole ?? null, e?.impressumUrl ?? null,
      hiringFlag(e), hiringFlag(e), e?.jobs?.careersUrl ?? null,
      tenantId, id
    );
}

/** Leads mit Website, bei denen noch Daten fehlen und die noch nicht ausgelesen wurden. */
export function leadsNeedingEnrichment(tenantId: string, f: LeadFilter, limit: number): Lead[] {
  const w = where(tenantId, f);
  return getDb()
    .prepare(`SELECT * FROM leads WHERE ${w.sql}
      AND website IS NOT NULL AND website <> '' AND enriched_at IS NULL
      AND (email IS NULL OR email = '' OR contact_name IS NULL OR contact_name = '' OR phone IS NULL OR phone = '')
      ORDER BY id DESC LIMIT ?`)
    .all(...w.args, limit) as unknown as Lead[];
}

export function listLeadsByIds(tenantId: string, ids: number[]): Lead[] {
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0);
  if (!clean.length) return [];
  return getDb()
    .prepare(`SELECT * FROM leads WHERE tenant_id = ? AND id IN (${clean.map(() => "?").join(",")}) ORDER BY ${ORDER_NEWEST}`)
    .all(tenantId, ...clean) as unknown as Lead[];
}

export function setStatusForIds(tenantId: string, ids: number[], status: LeadStatus) {
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0);
  if (!clean.length) return;
  getDb()
    .prepare(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id IN (${clean.map(() => "?").join(",")})`)
    .run(status, tenantId, ...clean);
}

export function markInObsidian(tenantId: string, ids: number[]) {
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0);
  if (!clean.length) return;
  getDb()
    .prepare(`UPDATE leads SET obsidian_at = datetime('now') WHERE tenant_id = ? AND id IN (${clean.map(() => "?").join(",")})`)
    .run(tenantId, ...clean);
}

export function saveScore(tenantId: string, id: number, score: number, reason: string) {
  getDb()
    .prepare("UPDATE leads SET score = ?, score_reason = ?, scored_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ? AND id = ?")
    .run(score, reason, tenantId, id);
}

/** Leads, die noch keine KI-Bewertung haben. */
export function leadsWithoutScore(tenantId: string, f: LeadFilter, limit: number): Lead[] {
  const w = where(tenantId, f);
  return getDb()
    .prepare(`SELECT * FROM leads WHERE ${w.sql} AND scored_at IS NULL ORDER BY id DESC LIMIT ?`)
    .all(...w.args, limit) as unknown as Lead[];
}

export function scoreStats(tenantId: string) {
  return getDb()
    .prepare(`SELECT
      SUM(CASE WHEN scored_at IS NOT NULL THEN 1 ELSE 0 END) AS scored,
      SUM(CASE WHEN score >= 8 THEN 1 ELSE 0 END) AS top
    FROM leads WHERE tenant_id = ?`)
    .get(tenantId) as { scored: number | null; top: number | null };
}
