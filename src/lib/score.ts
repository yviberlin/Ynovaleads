import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Lead } from "./leads";
import type { CustomerProfile } from "./settings";

/**
 * KI-Bewertung: Claude schätzt ein, wie gut ein Lead zum eigenen Angebot passt (1 bis 10 Punkte)
 * und begründet das in ein bis zwei Sätzen.
 */

export const SCORE_MODEL = "claude-opus-5-5";

const Bewertung = z.object({
  punkte: z.number().int().describe("Ganze Zahl von 1 (passt gar nicht) bis 10 (passt perfekt)"),
  begruendung: z.string().describe("Ein bis zwei kurze Sätze auf Deutsch, warum"),
});

export function aiAvailable(): { ok: true } | { ok: false; reason: string } {
  return process.env.ANTHROPIC_API_KEY?.trim()
    ? { ok: true }
    : { ok: false, reason: "Für die KI-Bewertung fehlt der Schlüssel ANTHROPIC_API_KEY in der Datei .env.local." };
}

let client: Anthropic | undefined;
function getClient() {
  client ??= new Anthropic({ maxRetries: 3 });
  return client;
}

const SYSTEM = `Du bewertest Firmen als mögliche Neukunden (B2B-Leads) für eine Selbstständige.
Du bekommst ihr Wunschkunden-Profil, die bekannten Daten einer Firma und, falls vorhanden, Text von der Website der Firma.
Schätze ein, wie gut die Firma als Kunde passt und wie wahrscheinlich sie das Angebot braucht.

Punkte:
- 9–10: passt sehr gut, klarer Bedarf erkennbar, gut erreichbar
- 7–8: passt gut, Bedarf wahrscheinlich
- 4–6: passt teilweise oder Bedarf unklar
- 1–3: passt nicht, fällt unter die Ausschlüsse oder ist kaum erreichbar

Bewerte nur anhand der Angaben. Erfinde keine Fakten. Fehlt die Website, ist das für Design- oder Website-Angebote eher ein Zeichen für Bedarf.
Die Begründung ist für die Nutzerin selbst: ein bis zwei kurze, konkrete Sätze auf Deutsch, ohne Fachjargon.`;

function describeLead(l: Lead): string {
  const lines = [
    `Firma: ${l.name}`,
    l.industry && `Branche: ${l.industry}`,
    [l.street, [l.zip, l.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") && `Adresse: ${[l.street, [l.zip, l.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}`,
    `Website: ${l.website || "keine bekannt"}`,
    `E-Mail: ${l.email || "keine bekannt"}`,
    `Telefon: ${l.phone || "keine bekannt"}`,
    `Ansprechpartner: ${l.contact_name ? `${l.contact_name}${l.contact_role ? ` (${l.contact_role})` : ""}` : "nicht bekannt"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function describeProfile(p: CustomerProfile): string {
  return [
    `Mein Angebot: ${p.angebot}`,
    `Meine Wunschkunden: ${p.zielkunden}`,
    `Region: ${p.region}`,
    `Gute Zeichen für Bedarf: ${p.gutesZeichen}`,
    `Passt nicht: ${p.ausschluss}`,
  ].join("\n");
}

export type ScoreResult = { score: number; reason: string };

export async function scoreLead(l: Lead, profile: CustomerProfile, websiteText?: string): Promise<ScoreResult> {
  const content = [
    `<profil>\n${describeProfile(profile)}\n</profil>`,
    `<firma>\n${describeLead(l)}\n</firma>`,
    websiteText ? `<website>\n${websiteText}\n</website>` : "<website>Website-Text nicht verfügbar.</website>",
  ].join("\n\n");

  const res = await getClient().messages.parse({
    model: SCORE_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(Bewertung) },
  });

  if (res.stop_reason === "refusal") throw new Error("Die KI wollte diesen Lead nicht bewerten.");
  const out = res.parsed_output;
  if (!out) throw new Error("Die KI hat keine verwertbare Bewertung geliefert.");
  return { score: Math.min(10, Math.max(1, Math.round(out.punkte))), reason: out.begruendung.trim() };
}

/** Übersetzt Fehler der KI-Schnittstelle in verständliche Sätze. */
export function friendlyAiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Der KI-Schlüssel (ANTHROPIC_API_KEY) stimmt nicht. Bitte in .env.local prüfen.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Der KI-Schlüssel hat keine Berechtigung für dieses Modell.";
  if (e instanceof Anthropic.RateLimitError) return "Die KI ist gerade ausgelastet oder das Guthaben ist aufgebraucht. Bitte später nochmal versuchen.";
  if (e instanceof Anthropic.APIConnectionError) return "Die KI ist gerade nicht erreichbar. Bitte Internetverbindung prüfen.";
  if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) return "Das Guthaben beim KI-Anbieter ist aufgebraucht. Bitte in der Anthropic Console aufladen.";
  if (e instanceof Anthropic.APIError) return `Die KI hat einen Fehler gemeldet (${e.status ?? "unbekannt"}).`;
  return e instanceof Error ? e.message : "Bewertung fehlgeschlagen.";
}
