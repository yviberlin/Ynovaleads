"use client";

import { useActionState } from "react";
import { saveCustomerProfile, type ProfileState } from "@/lib/actions";
import { SubmitButton } from "../components/submit-button";
import type { CustomerProfile } from "@/lib/settings";

const FIELDS: { key: keyof CustomerProfile; label: string; hint: string; rows: number }[] = [
  { key: "angebot", label: "Was biete ich an?", hint: "Deine Leistungen in ein, zwei Sätzen.", rows: 3 },
  { key: "zielkunden", label: "Wer sind meine Wunschkunden?", hint: "Branchen, Größe, Art der Firma.", rows: 3 },
  { key: "region", label: "In welcher Region?", hint: "z. B. Dresden und Umgebung oder ganz DACH.", rows: 1 },
  { key: "gutesZeichen", label: "Woran erkenne ich Bedarf?", hint: "Was macht eine Firma besonders interessant?", rows: 3 },
  { key: "ausschluss", label: "Wer passt nicht?", hint: "Firmen, die du nicht ansprechen möchtest.", rows: 3 },
];

export function ProfileForm({ profile }: { profile: CustomerProfile }) {
  const [state, action] = useActionState<ProfileState, FormData>(saveCustomerProfile, {});
  return (
    <form action={action} className="card" style={{ gap: 18 }}>
      {state.error && <div className="notice error" role="alert">{state.error}</div>}
      {state.saved && <div className="notice" role="status">Gespeichert. Neue Bewertungen nutzen ab jetzt dieses Profil.</div>}
      {FIELDS.map((f) => (
        <label key={f.key} className="field" htmlFor={f.key}>
          {f.label}
          <small>{f.hint}</small>
          {f.rows === 1
            ? <input id={f.key} name={f.key} type="text" defaultValue={profile[f.key]} />
            : <textarea id={f.key} name={f.key} rows={f.rows} defaultValue={profile[f.key]} />}
        </label>
      ))}
      <div><SubmitButton pendingText="Wird gespeichert …">Profil speichern</SubmitButton></div>
    </form>
  );
}
