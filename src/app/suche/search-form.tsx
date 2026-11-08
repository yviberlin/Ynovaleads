"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runSearch, type SearchState } from "@/lib/actions";

type SourceInfo = { id: string; label: string; description: string; costs: string; ok: boolean; reason?: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Suche läuft, bitte kurz warten …" : "Leads suchen"}
    </button>
  );
}

export function SearchForm({ sources, defaultSource, industries }: { sources: SourceInfo[]; defaultSource: string; industries: string[] }) {
  const [state, action] = useActionState<SearchState, FormData>(runSearch, {});
  return (
    <form action={action} className="card" style={{ gap: 20 }}>
      {state.error && <div className="notice error" role="alert">{state.error}</div>}
      <div className="search-form">
        <label className="field" htmlFor="query">
          Branche oder Stichwort
          <input id="query" name="query" type="text" list="industries" autoComplete="off" placeholder="z. B. Zahnarzt, Steuerberater, Friseur" required />
          <datalist id="industries">{industries.map((i) => <option key={i} value={i} />)}</datalist>
        </label>
        <label className="field" htmlFor="location">
          Ort oder PLZ
          <input id="location" name="location" type="text" placeholder="z. B. Berlin oder 80331" required />
        </label>
        <label className="field" htmlFor="limit">
          Wie viele?
          <input id="limit" name="limit" type="number" min={1} max={100} defaultValue={25} />
        </label>
      </div>
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <legend className="field" style={{ marginBottom: 8 }}>Woher sollen die Firmen kommen?</legend>
        <div className="sources">
          {sources.map((s) => (
            <label className="source" key={s.id}>
              <input type="radio" name="source" value={s.id} defaultChecked={s.id === defaultSource} disabled={!s.ok} />
              <b>{s.label}</b>
              <span>{s.description}</span>
              <em>{s.ok ? s.costs : s.reason}</em>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="check" htmlFor="enrich">
        <input id="enrich" type="checkbox" name="enrich" value="1" defaultChecked />
        Websites und Impressum gleich auslesen (E-Mail, Geschäftsführer). Dauert etwas länger.
      </label>
      <div><Submit /></div>
    </form>
  );
}
