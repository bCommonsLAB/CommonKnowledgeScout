---
name: Summen und Synergie-Aggregation (Tabelle + Graph)
overview: Zwei Stufen. Stufe 1 — Tabellenansicht bekommt eine Summen-Fusszeile fuer Zahlenfelder (z.B. co2_einsparung_kt, kosten_eur), serverseitig ueber den GESAMTEN gefilterten Bestand aggregiert (nicht nur die geladenen Zeilen). Stufe 2 — der Graph-Modus bekommt ein Summen-Panel, das zusaetzlich eine synergiebereinigte Summe zeigt, die die vorhandenen Aehnlichkeits-Kanten als Naeherung fuer Wirkungs-/Kosten-Ueberlappung nutzt (Greedy-Abzinsung, einstellbares Alpha). Kennzeichnung als Schaetzung ist Pflicht.
todos:
  - id: sums-api
    content: "Serverseitige Summen: docs-Route (src/app/api/chat/[libraryId]/docs/route.ts) um ?aggregate=sums erweitern ODER eigener schlanker Endpoint. Aggregiert per Mongo ueber den gesamten gefilterten Bestand (gleiche Filter-/Search-Logik wie die Liste). Response pro Feld: { sum, count, missing } — fehlende Werte NICHT als 0 zaehlen, sondern explizit melden (no-silent-fallbacks)."
    status: pending
  - id: sums-fields
    content: "Feld-Auswahl v1 OHNE neues Config-Feld: alle Facetten mit type 'number' und showInTable === true werden summiert (bei Klimamassnahmen: co2_einsparung_kt, durchsetzbarkeit, kosten_eur — durchsetzbarkeit ist ein Score, Summe sinnlos: nur Felder summieren, deren Werte additiv sind. Entscheidung: v1 explizite Positivliste im detail-view-type-Registry-Eintrag climateAction [co2_einsparung_kt, kosten_eur]; falls ein generisches Config-Feld gewuenscht wird, Checkliste .cursor/rules/library-config-field.mdc abarbeiten)."
    status: pending
  - id: table-footer
    content: "Tabellen-Fusszeile in virtualized-items-view.tsx (Table-Mode): eine Summenzeile unter der letzten Gruppe (bzw. unter der flachen Liste bei Spalten-Sortierung) mit den Server-Summen; Formatierung wie Zellen (tabular-nums, toLocaleString de-DE); Zusatzhinweis 'X ohne Angabe' bei missing > 0. Datei ist bereits >200 Zeilen — Fusszeile als eigene Komponente (z.B. gallery/table-sums-footer.tsx)."
    status: pending
  - id: synergy-lib
    content: "Pure Funktion computeSynergyAdjustedSum(items: {id, value}[], edges: {source, target, weight}[], alpha: number) in src/lib/graph/synergy-sum.ts. Greedy: absteigend nach value sortieren; Beitrag_k = value_k * Produkt ueber bereits gezaehlte Nachbarn j von (1 - alpha * s_kj). Unit-Tests (vitest): s=1 & gleiche Werte -> zaehlt ~1x; s=0 -> naive Summe; leere Edges -> naive Summe; fehlende Werte werden ausgelassen und gezaehlt; alpha=0 -> naive Summe."
    status: pending
  - id: graph-panel
    content: "Summen-Panel im Graph (doc-graph.tsx bzw. eigene Komponente graph/graph-sums-panel.tsx): zeigt pro Summenfeld naive Summe UND synergiebereinigte Summe nebeneinander, plus Alpha-Wahl ('Keine Synergie' 0 / 'Moderat' 0.5 / 'Stark' 0.9). Datenbasis: die bereits geladenen graphDocs + rawEdges aus use-similarity-edges (Similarity-Quelle aktiv). Deutliche Kennzeichnung als Schaetzung (Tooltip mit Methodik-Kurztext). i18n-Keys in ALLEN 5 Sprachen (de/en/es/fr/it)."
    status: pending
  - id: verify
    content: "Live-Verifikation gegen Prod-DB (MONGODB_DATABASE_NAME_PROD in .env aktivieren, danach zuruecksetzen; Worktree-Server auf Port 3001 via launch-Config next-dev-3001): Klimamassnahmen (606 Docs). Tabellen-Summe muss dem direkten Mongo-Aggregat entsprechen (read-only Query als Goldstandard); Graph-Panel: bereinigte Summe <= naive Summe, alpha=0 identisch; keine neuen Request-Schleifen (Netzwerk-Tab)."
    status: pending
---

# Summen und Synergie-Aggregation

## Kontext

Wunsch aus der Nutzung der Klimamassnahmen-Library (606 Quellen):

1. Die Tabellenansicht soll am Ende Summen fuer CO2-Einsparung (kt/Jahr) und
   Kosten (EUR) zeigen.
2. Aehnliche Massnahmen ueberlappen sich in Wirkung und Kosten. Im Graph-Modus
   (Aehnlichkeits-Kanten liegen dort bereits vor) soll deshalb zusaetzlich eine
   synergiebereinigte Summe angezeigt werden.

Vorarbeit (bereits auf diesem Branch, PR "Galerie-Performance + Graph-Skalierung"):
Der Graph laedt den kompletten gefilterten Bestand batchweise (use-all-gallery-docs),
mountet erst nach Abschluss und holt die Aehnlichkeits-Kanten gechunkt ueber
`POST doc-neighbors` (`use-similarity-edges` liefert `rawEdges` mit
`{source, target, weight}`, weight = Vector-Score). Diese Kanten sind die
Datenbasis fuer die Synergie-Rechnung — es ist KEIN neuer Endpoint noetig.

## Methodik (Stufe 2)

Das Problem heisst in der Klimapolitik-Literatur "Doppelzaehlung/Policy Overlap"
(UNEP Emissions Gap Report, ICAT Policy Guidance): naive Summen ueberschaetzen,
weil sich Massnahmen dieselben Emissionen teilen.

Naeherung mit den vorhandenen Kanten (Greedy-Abzinsung, verwandt mit Maximal
Marginal Relevance, Carbonell & Goldstein 1998, bzw. submodularen
Coverage-Funktionen):

1. Massnahmen absteigend nach Wert sortieren; die groesste zaehlt voll.
2. Jede weitere zaehlt mit Abschlag fuer Aehnlichkeit zu bereits gezaehlten
   Nachbarn: `Beitrag_k = Wert_k * Prod_j (1 - alpha * s_kj)`
   (j = bereits gezaehlte Nachbarn mit Kante zu k).
3. `alpha` in [0..1] steuert, wie stark thematische Aehnlichkeit als
   Wirkungs-Ueberlappung interpretiert wird (0 = naive Summe).

Grenzfaelle (muessen Tests abdecken): zwei identische Massnahmen (s=1) zaehlen
~einmal; unabhaengige (s=0 bzw. keine Kante) addieren sich voll.

WICHTIGE GRENZE (im UI transparent machen): Die Aehnlichkeit stammt aus
Text-Embeddings — sie misst THEMATISCHE Naehe, nicht kausale
Wirkungs-Ueberlappung ("PV auf Schuldaechern" vs. "PV auf Krankenhausdaechern"
sind textlich fast identisch, ihre Einsparungen addieren sich aber voll).
Deshalb: immer als Spanne anzeigen (naive Summe = Obergrenze, bereinigt =
konservative Schaetzung), nie als "die Summe" ausgeben. Fuer Kosten denselben
Mechanismus, aber eigener (vorsichtigerer) Default.

## Kontrakte / Stolpersteine

- no-silent-fallbacks: fehlende Zahlenwerte ("Kosten unbekannt") nicht als 0
  summieren — auslassen und als `missing` melden ("X ohne Angabe").
- massnahme_nr/Zahlenfelder: Werte kommen aus Mongo teils als number, teils als
  string — Mapper-Pfad pruefen (vgl. Fix in doc-meta-mappers 2026-07-08).
- Dateien max. 200 Zeilen: Fusszeile und Panel als eigene Komponenten.
- Tabellen-Summe MUSS vom Server kommen (die Liste laedt paginiert; Client-Summe
  ueber geladene Zeilen waere still falsch).
- i18n: neue Keys in de/en/es/fr/it gleichzeitig.
- Pipeline-/Storage-Contracts sind nicht betroffen (reine Lese-Aggregation).

## Verifikation

Playbook: docs/guides/verification-playbook.md. Prod-Daten lokal: .env
MONGODB_DATABASE_NAME auf den Wert von MONGODB_DATABASE_NAME_PROD stellen
(Backup anlegen, danach zuruecksetzen), Worktree-Server via launch-Config
`next-dev-3001`. Referenzwerte per read-only Mongo-Aggregat gegenpruefen.
