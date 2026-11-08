# Ynovaleads

Eigener B2B-Leadscraper: Firmen finden, Kontaktdaten sammeln, Leads verwalten.

## Was er schon kann (Schritt 1)

- **Dashboard** mit Zahlen zu deinen Leads, Status und letzten Suchen
- **Neue Suche** nach Branche und Ort, mit wählbarer Datenquelle
- **Lead-Liste** mit Filtern (Status, Ort, Branche, mit E-Mail, mit Ansprechpartner)
- **Lead-Status** (Neu, Kontaktiert, Termin, Kunde, Kein Interesse) und Notizen
- **Export** als CSV, öffnet sich direkt in Excel

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

2. Websites und Impressum automatisch auslesen (E-Mail, Geschäftsführer)
3. ROI-Rechner
4. KI-Bewertung der Leads
