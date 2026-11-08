"use client";

import { useEffect, useState } from "react";
import { LEAD_STATUSES } from "@/lib/status";
import { setStatusForSelected, sendSelectedToObsidian } from "@/lib/actions";

export const SELECTION_FORM = "auswahl";

function boxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form=${SELECTION_FORM}][name=id]`));
}

/** Häkchen im Tabellenkopf: alle sichtbaren Leads an- oder abwählen. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Alle auswählen"
      className="row-check"
      onChange={(e) => {
        boxes().forEach((b) => (b.checked = e.target.checked));
        document.dispatchEvent(new Event("selection-change"));
      }}
    />
  );
}

export function RowCheck({ id, name }: { id: number; name: string }) {
  return (
    <input
      type="checkbox"
      className="row-check"
      form={SELECTION_FORM}
      name="id"
      value={id}
      aria-label={`${name} auswählen`}
      onChange={() => document.dispatchEvent(new Event("selection-change"))}
    />
  );
}

/** Leiste mit Aktionen für die ausgewählten Leads. */
export function SelectionBar({ qs }: { qs: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("selection-change", update);
    update();
    return () => document.removeEventListener("selection-change", update);
  }, []);

  return (
    <form id={SELECTION_FORM} className={`selection-bar${count ? " active" : ""}`} action={setStatusForSelected}
      onSubmit={(e) => {
        // Nach "Status setzen" Auswahl leeren, nach dem Herunterladen behalten
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.dataset.clear) setTimeout(() => { boxes().forEach((b) => (b.checked = false)); setCount(0); }, 0);
      }}>
      <input type="hidden" name="qs" value={qs} />
      <span className="selection-count">
        {count ? `${count} ausgewählt` : "Hake Leads an, um sie gemeinsam zu bearbeiten"}
      </span>
      <button className="btn small ghost" type="submit" formAction="/leads/export" formMethod="get" disabled={!count}>
        Ausgewählte herunterladen
      </button>
      <button className="btn small" type="submit" formAction={sendSelectedToObsidian} disabled={!count}>
        In Obsidian übertragen
      </button>
      <select name="bulkStatus" aria-label="Neuer Status" defaultValue="kontaktiert" disabled={!count}>
        {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <button className="btn small" type="submit" data-clear="1" disabled={!count}>Status setzen</button>
    </form>
  );
}
