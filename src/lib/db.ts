import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MASTER_TENANT_ID } from "./tenant";

const dbPath =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "leadscraper.db");

const globalForDb = globalThis as unknown as { __leadDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      query TEXT NOT NULL,
      location TEXT NOT NULL,
      source TEXT NOT NULL,
      found INTEGER NOT NULL DEFAULT 0,
      added INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      search_id INTEGER REFERENCES searches(id) ON DELETE SET NULL,
      source TEXT NOT NULL,
      source_ref TEXT,
      name TEXT NOT NULL,
      industry TEXT,
      street TEXT,
      zip TEXT,
      city TEXT,
      country TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      contact_name TEXT,
      contact_role TEXT,
      status TEXT NOT NULL DEFAULT 'neu',
      score INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (tenant_id, source, source_ref)
    );

    CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_leads_tenant_city ON leads(tenant_id, city);
  `);
  // Spalten, die nach der ersten Version dazugekommen sind
  const cols = (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("impressum_url")) db.exec("ALTER TABLE leads ADD COLUMN impressum_url TEXT");
  if (!cols.includes("obsidian_at")) db.exec("ALTER TABLE leads ADD COLUMN obsidian_at TEXT");
  if (!cols.includes("enriched_at")) db.exec("ALTER TABLE leads ADD COLUMN enriched_at TEXT");
  if (!cols.includes("score_reason")) db.exec("ALTER TABLE leads ADD COLUMN score_reason TEXT");
  if (!cols.includes("scored_at")) db.exec("ALTER TABLE leads ADD COLUMN scored_at TEXT");

  // Einstellungen pro Kunde (z. B. das Wunschkunden-Profil für die KI-Bewertung)
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (tenant_id, key)
  )`);

  db.prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)").run(
    MASTER_TENANT_ID,
    "Master"
  );
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__leadDb) globalForDb.__leadDb = open();
  return globalForDb.__leadDb;
}
