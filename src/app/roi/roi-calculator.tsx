"use client";

import { useEffect, useState } from "react";

export type RealNumbers = { total: number; contacted: number; meetings: number; customers: number };

type Values = {
  leads: number;
  kontaktQuote: number; // % der Leads, die du erreichst
  terminQuote: number; // % der erreichten, die einen Termin wollen
  abschlussQuote: number; // % der Termine, die Kunde werden
  auftragswert: number; // € pro Auftrag
  datenKosten: number; // € pro Lead (Google, KI)
  minutenProLead: number; // Zeit für Recherche und Ansprache
  stundensatz: number; // € pro Stunde
};

const DEFAULTS: Values = {
  leads: 100,
  kontaktQuote: 60,
  terminQuote: 15,
  abschlussQuote: 30,
  auftragswert: 2500,
  datenKosten: 0.05,
  minutenProLead: 10,
  stundensatz: 60,
};

const STORE = "ynovaleads-roi";
const eur = (n: number, digits = 0) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits });
const num = (n: number, digits = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: digits });

function Field({ label, hint, value, onChange, step = 1, suffix }: { label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="field">
      {label}
      <small>{hint ?? "\u00a0"}</small>
      <span className="roi-input">
        <input type="number" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
        <span>{suffix ?? ""}</span>
      </span>
    </label>
  );
}

export function RoiCalculator({ real }: { real: RealNumbers }) {
  const [v, setV] = useState<Values>({ ...DEFAULTS, leads: real.total || DEFAULTS.leads });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) setV((cur) => ({ ...cur, ...JSON.parse(saved) }));
    } catch {}
  }, []);
  const set = (k: keyof Values) => (n: number) =>
    setV((cur) => {
      const next = { ...cur, [k]: n };
      try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
      return next;
    });

  const contacts = v.leads * (v.kontaktQuote / 100);
  const meetings = contacts * (v.terminQuote / 100);
  const customers = meetings * (v.abschlussQuote / 100);
  const revenue = customers * v.auftragswert;
  const costData = v.leads * v.datenKosten;
  const costTime = v.leads * (v.minutenProLead / 60) * v.stundensatz;
  const cost = costData + costTime;
  const profit = revenue - cost;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;
  const perLead = v.leads ? revenue / v.leads : 0;
  const leadsPerCustomer = customers > 0 ? v.leads / customers : 0;

  const funnel = [
    { label: "Leads", n: v.leads },
    { label: "Erreicht", n: contacts },
    { label: "Termine", n: meetings },
    { label: "Neukunden", n: customers },
  ];

  // Echte Quoten aus der Lead-Liste (erst sinnvoll, wenn genug kontaktiert wurde)
  const realRates = real.contacted >= 10 && real.total > 0
    ? {
        kontaktQuote: Math.round((real.contacted / real.total) * 100),
        terminQuote: Math.round((real.meetings / real.contacted) * 100),
        abschlussQuote: real.meetings ? Math.round((real.customers / real.meetings) * 100) : 0,
      }
    : null;

  return (
    <div className="roi">
      <section className="card">
        <h2>Deine Werte</h2>
        <div className="roi-fields">
          <Field label="Anzahl Leads" hint="Vorschlag: deine Liste" value={v.leads} onChange={set("leads")} />
          <Field label="Erreicht" hint="Wie viele erreichst du?" value={v.kontaktQuote} onChange={set("kontaktQuote")} suffix="%" />
          <Field label="Termin" hint="Von den Erreichten" value={v.terminQuote} onChange={set("terminQuote")} suffix="%" />
          <Field label="Auftrag" hint="Von den Terminen" value={v.abschlussQuote} onChange={set("abschlussQuote")} suffix="%" />
          <Field label="Auftragswert" hint="Durchschnitt pro Kunde" value={v.auftragswert} onChange={set("auftragswert")} step={100} suffix="€" />
          <Field label="Datenkosten pro Lead" hint="Google und KI, ein paar Cent" value={v.datenKosten} onChange={set("datenKosten")} step={0.01} suffix="€" />
          <Field label="Zeit pro Lead" hint="Recherche, Anruf, E-Mail" value={v.minutenProLead} onChange={set("minutenProLead")} suffix="Min." />
          <Field label="Dein Stundensatz" hint="Was deine Zeit wert ist" value={v.stundensatz} onChange={set("stundensatz")} step={5} suffix="€" />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {realRates && (
            <button className="btn small" type="button" onClick={() => setV((cur) => { const next = { ...cur, leads: real.total, ...realRates }; try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {} return next; })}>
              Meine echten Quoten übernehmen
            </button>
          )}
          <button className="btn small ghost" type="button" onClick={() => { const next = { ...DEFAULTS, leads: real.total || DEFAULTS.leads }; setV(next); try { localStorage.removeItem(STORE); } catch {} }}>
            Zurücksetzen
          </button>
        </div>
        <p className="roi-note">
          {realRates
            ? `Aus deiner Lead-Liste: ${real.contacted} kontaktiert, ${real.meetings} Termine, ${real.customers} Kunden.`
            : `Sobald du mindestens 10 Leads kontaktiert hast (Status ändern), kann der Rechner deine echten Quoten verwenden. Bisher: ${real.contacted}.`}
        </p>
      </section>

      <div className="roi-results">
        <div className="grid kpis">
          <div className="card kpi accent">
            <span className="label">Umsatz</span>
            <span className="value">{eur(revenue)}</span>
          </div>
          <div className="card kpi">
            <span className="label">Gewinn nach Kosten</span>
            <span className="value" style={{ color: profit < 0 ? "var(--hibiskus-strong)" : undefined }}>{eur(profit)}</span>
          </div>
          <div className="card kpi">
            <span className="label">ROI</span>
            <span className="value">{num(roi)} %</span>
          </div>
          <div className="card kpi">
            <span className="label">Neukunden</span>
            <span className="value">{num(customers, 1)}</span>
          </div>
        </div>

        <section className="card">
          <h2>Vom Lead zum Kunden</h2>
          <div className="bars">
            {funnel.map((f) => (
              <div className="bar-row" key={f.label}>
                <span>{f.label}</span>
                <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${v.leads ? Math.min(100, (f.n / v.leads) * 100) : 0}%` }} /></span>
                <span className="num">{num(f.n, f.n < 10 ? 1 : 0)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>So setzt sich das zusammen</h2>
          <dl className="dl">
            <dt>Kosten für Daten</dt><dd>{eur(costData, 2)}</dd>
            <dt>Kosten für deine Zeit</dt><dd>{eur(costTime)} ({num((v.leads * v.minutenProLead) / 60, 1)} Std.)</dd>
            <dt>Kosten gesamt</dt><dd><b>{eur(cost)}</b></dd>
            <dt>Ein Lead ist wert</dt><dd>{eur(perLead, 2)}</dd>
            <dt>Leads pro Neukunde</dt><dd>{leadsPerCustomer ? `ca. ${num(leadsPerCustomer)}` : "—"}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
