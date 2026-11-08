import Link from "next/link";
import { getCurrentTenantId } from "@/lib/tenant";
import { countLeads, distinctValues, listLeads, parseFilter } from "@/lib/leads";
import { LEAD_STATUSES } from "@/lib/status";
import { StatusSelect } from "../components/status-select";
import { SubmitButton } from "../components/submit-button";
import { RowCheck, SelectAll, SelectionBar } from "../components/selection";
import { enrichFiltered } from "@/lib/actions";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getCurrentTenantId();
  const f = parseFilter(sp);
  const leads = listLeads(t, f);
  const total = countLeads(t, f);
  const all = countLeads(t);
  const cities = distinctValues(t, "city");
  const industries = distinctValues(t, "industry");
  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v && !["neu", "gefunden", "ergaenzt", "geprueft", "obsidian", "obsidianDa", "obsidianFehler"].includes(k) ? [[k, v]] : []))
  ).toString();
  const fresh = typeof sp.neu === "string" ? Number(sp.neu) : null;
  const found = typeof sp.gefunden === "string" ? Number(sp.gefunden) : null;
  const improved = typeof sp.ergaenzt === "string" ? Number(sp.ergaenzt) : null;
  const checked = typeof sp.geprueft === "string" ? Number(sp.geprueft) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p>{total === all ? `${all} Leads` : `${total} von ${all} Leads`}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <form action={enrichFiltered}>
            <input type="hidden" name="qs" value={qs} />
            <SubmitButton className="btn ghost" pendingText="Websites werden gelesen …">Fehlende Daten ergänzen</SubmitButton>
          </form>
          <a href={`/leads/export${qs ? "?" + qs : ""}`} className="btn ghost">Als Excel/CSV herunterladen</a>
          <Link href="/suche" className="btn">Neue Suche</Link>
        </div>
      </div>

      {fresh !== null && (
        <div className="notice" role="status">
          {found === 0
            ? "Für diese Suche wurden keine Firmen gefunden. Versuch es mit einem anderen Stichwort oder einem größeren Ort."
            : `${found} Firmen gefunden, davon ${fresh} neu in deiner Liste.${fresh < (found ?? 0) ? " Der Rest war schon vorhanden." : ""}`}
        </div>
      )}

      {typeof sp.obsidian === "string" && (
        <div className="notice" role="status">{sp.obsidian === "1" ? "1 Lead" : `${sp.obsidian} Leads`} in deine Kommandozentrale übertragen.{typeof sp.obsidianDa === "string" && (sp.obsidianDa === "1" ? " 1 Lead war schon dort und wurde nicht verändert." : ` ${sp.obsidianDa} Leads waren schon dort und wurden nicht verändert.`)}</div>
      )}
      {typeof sp.obsidianFehler === "string" && (
        <div className="notice error" role="alert">{sp.obsidianFehler}</div>
      )}

      {improved !== null && (
        <div className="notice" role="status">
          {checked === 0
            ? "Alle Leads mit Website sind schon ausgelesen."
            : `${checked} Websites gelesen, bei ${improved} Leads neue Daten gefunden.${checked === 40 ? " Klick nochmal, um die nächsten zu ergänzen." : ""}`}
        </div>
      )}

      <form className="filters" method="get">
        {f.searchId && <input type="hidden" name="suche" value={f.searchId} />}
        <input type="search" name="q" placeholder="Firma, E-Mail oder Name suchen" defaultValue={f.q ?? ""} aria-label="Suchen" />
        <select name="status" defaultValue={f.status ?? ""} aria-label="Status">
          <option value="">Alle Status</option>
          {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="ort" defaultValue={f.city ?? ""} aria-label="Ort">
          <option value="">Alle Orte</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="branche" defaultValue={f.industry ?? ""} aria-label="Branche">
          <option value="">Alle Branchen</option>
          {industries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" name="email" value="1" defaultChecked={f.hasEmail} /> mit E-Mail</label>
        <label className="check"><input type="checkbox" name="kontakt" value="1" defaultChecked={f.hasContact} /> mit Ansprechpartner</label>
        <button className="btn small" type="submit">Filtern</button>
        {qs && <Link href="/leads" className="btn small ghost">Zurücksetzen</Link>}
      </form>

      {leads.length === 0 ? (
        <div className="card empty">
          <h2>{all === 0 ? "Noch keine Leads" : "Keine Treffer"}</h2>
          <p>{all === 0 ? "Starte eine Suche, dann erscheinen deine Leads hier." : "Mit diesen Filtern gibt es keine Leads. Probier es mit weniger Filtern."}</p>
          {all === 0 && <Link href="/suche" className="btn">Erste Suche starten</Link>}
        </div>
      ) : (
        <>
        <SelectionBar qs={qs} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="check-col"><SelectAll /></th>
                <th>Firma</th>
                <th>Ansprechpartner</th>
                <th>Kontakt</th>
                <th>Ort</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="check-col"><RowCheck id={l.id} name={l.name} /></td>
                  <td>
                    <Link className="name" href={`/leads/${l.id}`}>{l.name}</Link>
                    <span className="sub">{l.industry}{l.source === "demo" && <> · <span className="pill">Beispiel</span></>}{l.obsidian_at && <> · <span className="pill pill-obsidian">in Obsidian</span></>}</span>
                  </td>
                  <td>
                    {l.contact_name ? <>{l.contact_name}<span className="sub">{l.contact_role}</span></> : <span className="missing">—</span>}
                  </td>
                  <td>
                    {l.email ? <span>{l.email}</span> : <span className="missing">keine E-Mail</span>}
                    <span className="sub">
                      {l.phone ?? ""}
                      {l.phone && l.website ? " · " : ""}
                      {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer">{hostOf(l.website)}</a>}
                    </span>
                  </td>
                  <td>
                    {l.city ?? <span className="missing">—</span>}
                    <span className="sub">{[l.street, l.zip].filter(Boolean).join(", ")}</span>
                  </td>
                  <td><StatusSelect id={l.id} status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}
