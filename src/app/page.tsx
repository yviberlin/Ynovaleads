import Link from "next/link";
import { getCurrentTenantId } from "@/lib/tenant";
import { countLeads, dataQuality, recentSearches, statusCounts } from "@/lib/leads";
import { LEAD_STATUSES } from "@/lib/status";
import { getSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export default async function Dashboard() {
  const t = await getCurrentTenantId();
  const total = countLeads(t);
  const counts = statusCounts(t);
  const q = dataQuality(t);
  const searches = recentSearches(t);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Deine Leads auf einen Blick.</p>
        </div>
        <Link href="/suche" className="btn">Neue Suche starten</Link>
      </div>

      <div className="grid kpis">
        <div className="card kpi accent">
          <span className="label">Leads gesamt</span>
          <span className="value">{total}</span>
        </div>
        <div className="card kpi">
          <span className="label">Neu</span>
          <span className="value">{counts.neu ?? 0}</span>
        </div>
        <div className="card kpi">
          <span className="label">Kontaktiert</span>
          <span className="value">{(counts.kontaktiert ?? 0) + (counts.termin ?? 0)}</span>
        </div>
        <div className="card kpi">
          <span className="label">Kunden</span>
          <span className="value">{counts.kunde ?? 0}</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="card empty">
          <h2>Noch keine Leads</h2>
          <p>Starte deine erste Suche, zum Beispiel „Zahnarzt“ in „Berlin“.</p>
          <Link href="/suche" className="btn">Erste Suche starten</Link>
        </div>
      ) : (
        <div className="grid two">
          <section className="card">
            <h2>Was steckt in deinen Leads?</h2>
            <div className="bars">
              {[
                ["mit E-Mail", q.withEmail],
                ["mit Telefon", q.withPhone],
                ["mit Website", q.withWebsite],
                ["mit Ansprechpartner", q.withContact],
              ].map(([label, n]) => (
                <div className="bar-row" key={label as string}>
                  <span>{label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${pct(n as number, q.total)}%` }} /></div>
                  <span className="num">{pct(n as number, q.total)} %</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Status</h2>
            <div className="bars">
              {LEAD_STATUSES.map((s) => (
                <Link href={`/leads?status=${s.id}`} className="bar-row" key={s.id} style={{ textDecoration: "none" }}>
                  <span>{s.label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${pct(counts[s.id] ?? 0, total)}%` }} /></div>
                  <span className="num">{counts[s.id] ?? 0}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="card">
        <h2>Letzte Suchen</h2>
        {searches.length === 0 ? (
          <p className="meta" style={{ margin: 0, color: "var(--muted)" }}>Noch keine Suche gestartet.</p>
        ) : (
          <ul className="list">
            {searches.map((s) => (
              <li key={s.id}>
                <div>
                  <Link href={`/leads?suche=${s.id}`}><b>{s.query}</b> in {s.location}</Link>
                  <div className="meta">{getSource(s.source)?.label ?? s.source} · {new Date(s.created_at + "Z").toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</div>
                </div>
                <div className="meta" style={{ textAlign: "right" }}>
                  {s.found} gefunden<br />{s.added} neu
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
