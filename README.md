# Ynovaleads

Eigener B2B-Leadscraper: Firmen finden, Kontaktdaten sammeln, Leads verwalten.

## Was er schon kann (Schritt 1)

- **Dashboard** mit Zahlen zu deinen Leads, Status und letzten Suchen
- **Neue Suche** nach Branche und Ort, mit wählbarer Datenquelle
- **Lead-Liste** mit Filtern (Status, Ort, Branche, mit E-Mail, mit Ansprechpartner)
- **Lead-Status** (Neu, Kontaktiert, Termin, Kunde, Kein Interesse) und Notizen
- **Export** als CSV, öffnet sich direkt in Excel
- **Impressum auslesen:** E-Mail, Telefon und Geschäftsführer bzw. Inhaber werden automatisch von der Website geholt (bei der Suche oder per Button). Vorhandene Daten werden nie überschrieben.

## Leads auswählen und in die Kommandozentrale übertragen

In der Lead-Liste hakst du einzelne Leads an. Dann kannst du:

- **In Obsidian übertragen:** Jeder Lead wird eine Notiz im Obsidian-Tresor, im gleichen Aufbau wie die Lead-Vorlage der Kommandozentrale (`typ: lead`, `firma`, `kontakt`, `status` …). Gibt es die Notiz schon, bleibt sie unverändert, damit deine Änderungen in Obsidian erhalten bleiben.
- **Ausgewählte herunterladen** als CSV
- **Status setzen** für alle ausgewählten auf einmal

Dafür in `.env.local` eintragen:

```
OBSIDIAN_VAULT_PATH=/Pfad/zu/deinem/Tresor
OBSIDIAN_LEADS_FOLDER=Leads/01 Aktuell
```

## KI-Bewertung

Unter **Wunschkunden-Profil** beschreibst du, was du anbietest und welche Firmen gut passen.
Danach bewertet Claude (Anthropic) jeden Lead mit **1 bis 10 Punkten** und einer kurzen Begründung.
Dafür liest die App auch die Startseite der Firma.

- In der Lead-Liste: „Mit KI bewerten“ (bis zu 25 noch nicht bewertete Leads auf einmal) oder angehakte Leads bewerten
- Filter „ab 8 Punkten“ und Sortierung „Beste Bewertung zuerst“
- Auf der Lead-Seite: Begründung lesen und neu bewerten lassen
- In Obsidian wird aus der Bewertung die `prio` (8–10 hoch, 5–7 mittel, 1–4 niedrig), dazu `bewertung`

Kosten: ungefähr 1 Cent pro Lead. Dafür in `.env.local` eintragen:

```
ANTHROPIC_API_KEY=dein-schluessel
```

## Datenquellen

| Quelle | Kosten | Hinweis |
| --- | --- | --- |
| OpenStreetMap | kostenlos | nicht jede Firma ist eingetragen |
| Google Maps | Monatskontingent frei, danach wenige Cent | braucht `GOOGLE_PLACES_API_KEY` |
| Beispieldaten | kostenlos | erfundene Firmen zum Ausprobieren |

Neue Quellen kommen nach `src/lib/sources/` und werden in `src/lib/sources/index.ts` eingetragen.

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:3000 öffnen. Braucht Node.js 22.13 oder neuer (die Datenbank ist SQLite, direkt in Node eingebaut).

## Später für Kunden

Alle Daten hängen schon heute an einem Mandanten (`tenant_id`). In der Master-Version ist das immer `master` (siehe `src/lib/tenant.ts`).
Für Kunden kommen später ein Login und ein eigener Mandant pro Kunde dazu, ohne dass die übrige App umgebaut werden muss.

## Nächste Schritte

- ROI-Rechner
