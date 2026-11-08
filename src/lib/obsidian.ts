import fs from "node:fs";
import path from "node:path";
import type { Lead } from "./leads";
import { statusLabel } from "./status";

/**
 * Überträgt Leads als Notizen in einen Obsidian-Tresor (Kommandozentrale).
 * Jeder Lead wird eine Markdown-Datei mit Eigenschaften oben (Frontmatter).
 */

export function obsidianConfig() {
  const vault = process.env.OBSIDIAN_VAULT_PATH?.trim();
  const folder = process.env.OBSIDIAN_LEADS_FOLDER?.trim() || "Leads/01 Aktuell";
  return vault ? { vault, folder, dir: path.join(vault, folder) } : undefined;
}

/** Status-Namen der Kommandozentrale: neu, kontaktiert, angebot, gewonnen, verloren */
const STATUS_MAP: Record<string, string> = {
  neu: "neu",
  kontaktiert: "kontaktiert",
  termin: "kontaktiert",
  kunde: "gewonnen",
  kein_interesse: "verloren",
};

const SOURCE_NAMES: Record<string, string> = { osm: "OpenStreetMap", google: "Google Maps", demo: "Beispieldaten" };

function yaml(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return String(v);
  // Nur quoten, wenn YAML sonst stolpern würde
  return /^[\p{L}\p{N}][\p{L}\p{N} .,&()'+\/@–-]*$/u.test(v) && !/: /.test(v) ? v : JSON.stringify(v);
}

/** Baut eine Lead-Notiz im Aufbau der Kommandozentrale (gleiche Eigenschaften wie die Vorlage). */
export function leadToMarkdown(l: Lead, today = new Date().toISOString().slice(0, 10)): string {
  const kontakt = l.contact_name ? `${l.contact_name}${l.contact_role ? `, ${l.contact_role}` : ""}` : "";
  const adresse = [l.street, [l.zip, l.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const props: [string, string | number | null][] = [
    ["typ", "lead"],
    ["firma", l.name],
    ["kontakt", kontakt],
    ["quelle", `Ynovaleads (${SOURCE_NAMES[l.source] ?? l.source})`],
    ["status", STATUS_MAP[l.status] ?? "neu"],
    ["prio", "mittel"],
    ["wert", 0],
    ["naechster_kontakt", ""],
    ["naechster_schritt", l.status === "neu" ? "Erstkontakt aufnehmen" : ""],
    ["link", l.website],
    ["branche", l.industry],
    ["email", l.email],
    ["telefon", l.phone],
    ["ort", l.city],
    ["ynovaleads_id", l.id],
  ];
  const front = props.map(([k, v]) => `${k}: ${yaml(v)}`.trimEnd()).join("\n");
  const kontaktdaten = [
    kontakt && `- Ansprechpartner: ${kontakt}`,
    l.email && `- E-Mail: ${l.email}`,
    l.phone && `- Telefon: ${l.phone}`,
    l.website && `- Website: ${l.website}`,
    l.impressum_url && `- Impressum: ${l.impressum_url}`,
    adresse && `- Adresse: ${adresse}`,
  ].filter(Boolean);
  return [
    `---\n${front}\n---`,
    "",
    "## Bedarf",
    l.industry ? `${l.industry}${l.city ? ` in ${l.city}` : ""}. Bedarf noch klären.` : "Bedarf noch klären.",
    "",
    "## Kontaktdaten",
    ...kontaktdaten,
    "",
    "## Verlauf",
    `- ${today}: Lead aus Ynovaleads übernommen`,
    ...(l.notes?.trim() ? l.notes.trim().split("\n").map((n) => `- ${n}`) : []),
    "",
  ].join("\n");
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Lead";
}

/**
 * Sucht einen freien Dateinamen. Gibt es die Notiz zu diesem Lead schon,
 * wird sie nicht angefasst, damit Änderungen in Obsidian erhalten bleiben.
 */
function targetFile(dir: string, l: Lead): string | null {
  const base = safeFileName(l.name);
  for (let n = 1; n < 50; n++) {
    const file = path.join(dir, `${base}${n > 1 ? ` ${n}` : ""}.md`);
    if (!fs.existsSync(file)) return file;
    const head = fs.readFileSync(file, "utf8").slice(0, 2000);
    if (new RegExp(`^ynovaleads_id: ${l.id}$`, "m").test(head)) return null;
  }
  return path.join(dir, `${base} ${Date.now()}.md`);
}

export function writeLeadsToObsidian(leads: Lead[]): { written: number; skipped: number; dir: string } {
  const cfg = obsidianConfig();
  if (!cfg) throw new Error("Der Obsidian-Ordner ist noch nicht eingetragen (OBSIDIAN_VAULT_PATH in der Datei .env.local).");
  if (!fs.existsSync(cfg.vault)) throw new Error(`Den Obsidian-Ordner „${cfg.vault}“ finde ich nicht. Ist die Festplatte angeschlossen?`);
  fs.mkdirSync(cfg.dir, { recursive: true });
  let written = 0;
  let skipped = 0;
  for (const l of leads) {
    const file = targetFile(cfg.dir, l);
    if (!file) { skipped++; continue; }
    fs.writeFileSync(file, leadToMarkdown(l), "utf8");
    written++;
  }
  return { written, skipped, dir: cfg.dir };
}
