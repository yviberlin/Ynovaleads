import { getDb } from "./db";
import type { FoundCompany } from "./sources";
import type { LeadStatus } from "./status";

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
  if (f.hasEmail) clauses.push("email IS NOT NULL AND email <> ''");
  if (f.hasContact) clauses.push("contact_name IS NOT NULL AND contact_name <> ''");
  return { sql: clauses.join(" AND "), args };
}

export function listLeads(tenantId: string, f: LeadFilter = {}, limit = 500): Lead[] {
  const w = where(tenantId, f);
  return getDb()
    .prepare(`SELECT * FROM leads WHERE ${w.sql} ORDER BY created_at DESC, id DESC LIMIT ?`)
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
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const c of companies) {
      const r = insert.run(
        tenantId, searchId, search.source, c.sourceRef, c.name,
        c.industry ?? null, c.street ?? null, c.zip ?? null, c.city ?? null, c.country ?? null,
        c.phone ?? null, c.email ?? null, c.website ?? null, c.contactName ?? null, c.contactRole ?? null
      );
      added += Number(r.changes);
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
  return {
    q: one("q"),
    status: one("status"),
    city: one("ort"),
    industry: one("branche"),
    hasEmail: one("email") === "1",
    hasContact: one("kontakt") === "1",
    searchId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
  };
}
