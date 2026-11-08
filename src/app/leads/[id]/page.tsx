import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTenantId } from "@/lib/tenant";
import { getLead } from "@/lib/leads";
import { getSource } from "@/lib/sources";
import { saveNotes, removeLead, enrichOne, scoreOne } from "@/lib/actions";
import { ScoreBadge } from "../../components/score-badge";
import { SubmitButton } from "../../components/submit-button";
import { StatusSelect } from "../../components/status-select";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const t = await getCurrentTenantId();
  const l = getLead(t, Number(id));
  if (!l) notFound();

  const rows: [string, React.ReactNode][] = [
    ["Branche", l.industry],
    ["Ansprechpartner", l.contact_name ? `${l.contact_name}${l.contact_role ? ` (${l.contact_role})` : ""}` : null],
    ["E-Mail", l.email],
    ["Telefon", l.phone],
    ["Website", l.website ? <a href={l.website} target="_blank" rel="noopener noreferrer">{l.website}</a> : null],
    ["Adresse", [l.street, [l.zip, l.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null],
    ["Stellt ein", l.hiring === 1 ? (l.careers_url ? <>Ja · <a href={l.careers_url} target="_blank" rel="noopener noreferrer">Karriereseite öffnen</a></> : "Ja") : l.hiring === 0 ? "Keine offenen Stellen gefunden" : null],
    ["Impressum", l.impressum_url ? <a href={l.impressum_url} target="_blank" rel="noopener noreferrer">Impressum öffnen</a> : null],
    ["Quelle", getSource(l.source)?.label ?? l.source],
    ["Gefunden am", new Date(l.created_at + "Z").toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })],
  ];

  return (
    <>
      <div><Link href="/leads" style={{ color: "var(--muted)" }}>← Zurück zu den Leads</Link></div>
      <div className="page-head">
        <div>
          <h1>{l.name}</h1>
          <p>{l.city}{l.source === "demo" && " · Beispieldaten"}</p>
        </div>
        <StatusSelect id={l.id} status={l.status} />
      </div>
      <section className="card">
        <h2>KI-Bewertung</h2>
        {typeof sp.bewertungFehler === "string" && <div className="notice error" role="alert">{sp.bewertungFehler}</div>}
        {l.scored_at ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ScoreBadge score={l.score} /> <strong>von 10 Punkten</strong>
            </div>
            <p className="score-reason">{l.score_reason}</p>
          </>
        ) : (
          <p className="score-reason" style={{ color: "var(--muted)" }}>Noch nicht bewertet. Die KI schaut sich die Daten und die Website an und vergleicht sie mit deinem <Link href="/einstellungen">Wunschkunden-Profil</Link>.</p>
        )}
        <form action={scoreOne}>
          <input type="hidden" name="id" value={l.id} />
          <SubmitButton className="btn small ghost" pendingText="KI bewertet …">{l.scored_at ? "Neu bewerten" : "Mit KI bewerten"}</SubmitButton>
        </form>
      </section>
      <div className="grid two">
        <section className="card">
          <h2>Kontaktdaten</h2>
          <dl className="dl">
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v ?? <span style={{ color: "var(--muted)" }}>nicht gefunden</span>}</dd>
              </div>
            ))}
          </dl>
          {l.website && (
            <form action={enrichOne}>
              <input type="hidden" name="id" value={l.id} />
              <SubmitButton className="btn small ghost" pendingText="Website wird gelesen …">
                {l.enriched_at ? "Website nochmal auslesen" : "Daten von der Website holen"}
              </SubmitButton>
            </form>
          )}
        </section>
        <section className="card">
          <h2>Notizen</h2>
          <form action={saveNotes} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="id" value={l.id} />
            <textarea id="notes" name="notes" rows={8} defaultValue={l.notes ?? ""} placeholder="z. B. Am 12.11. angerufen, Rückruf nächste Woche" aria-label="Notizen" />
            <div><button className="btn small" type="submit">Notiz speichern</button></div>
          </form>
          <form action={removeLead} style={{ marginTop: "auto" }}>
            <input type="hidden" name="id" value={l.id} />
            <button className="btn small danger" type="submit">Lead löschen</button>
          </form>
        </section>
      </div>
    </>
  );
}
