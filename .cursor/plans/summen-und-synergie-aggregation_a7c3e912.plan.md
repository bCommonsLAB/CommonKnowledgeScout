---
name: Summen und Synergie-Aggregation (Tabelle + Graph)
overview: Drei Stufen. Stufe 1 — Tabellenansicht bekommt eine Summen-Fusszeile fuer Zahlenfelder (z.B. co2_einsparung_kt, kosten_eur), serverseitig ueber den GESAMTEN gefilterten Bestand aggregiert (nicht nur die geladenen Zeilen). Stufe 2 — der Graph-Modus bekommt ein Summen-Panel, das zusaetzlich eine synergiebereinigte Summe zeigt, die die vorhandenen Aehnlichkeits-Kanten als Naeherung fuer Wirkungs-/Kosten-Ueberlappung nutzt (Greedy-Abzinsung, einstellbares Alpha). Stufe 3 — LLM-Overlap-Bericht: ein Long-Context-Lauf (1M Token) bekommt die wirkungsstaerksten Massnahmen als Tabelle und entscheidet pro Massnahme FACHLICH, ob sich Wirkung/Kosten mit bereits gezaehlten Massnahmen ueberlappen (Korrekturfaktoren + Begruendung, persistiert); ersetzt den Alpha-Proxy durch ein auditierbares Urteil. Kennzeichnung als Schaetzung ist in allen Stufen Pflicht.
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
  - id: llm-context-export
    content: "Stufe 3a — Kontext-Export: Endpoint/Job baut aus dem gefilterten Bestand die LLM-Eingabe: Massnahmen absteigend nach co2_einsparung_kt sortiert als kompakte Tabelle (massnahme_nr, Titel, Kurzbeschreibung/summary, co2_einsparung_kt, kosten_eur), Auswahl per Wirkungs-Schwelle bzw. Top-N (Default: alle mit CO2-Angabe; Massnahmen OHNE Angabe explizit als eigener Abschnitt ausweisen, nicht still weglassen). Die vorhandenen Similarity-Kanten (doc-neighbors) werden als Pruef-Hinweise mitgegeben: 'Paar (nr_a, nr_b) ist textlich aehnlich — entscheide, ob echte Wirkungs-Ueberlappung vorliegt'. Ausgabe passt in 1M-Token-Kontext (600 Massnahmen kompakt ~ deutlich darunter). UMGESETZT 2026-07-08: overlap-report-prompt.ts (selectOverlapMeasures, buildOverlapCatalogTable, Hinweise via buildNeighborsPayload)."
    status: completed
  - id: llm-overlap-job
    content: "Stufe 3b — LLM-Lauf (external-job, ADR-0001 beachten): Prompt verlangt Greedy-Semantik konsistent zu Stufe 2 — Liste ist absteigend nach Wirkung sortiert, pro Massnahme ein Korrekturfaktor [0..1] RELATIV zu den weiter oben stehenden (bereits gezaehlten) Massnahmen. ZWEI getrennte Faktoren: korrektur_faktor_co2 (Doppelzaehlung geteilter Emissionen) und korrektur_faktor_kosten (Kosten-Synergien durch Buendelung/gemeinsame Infrastruktur) — getrennt begruendet. Pflicht-Output pro Massnahme: beide Faktoren, ueberlappt_mit (massnahme_nrs), kurze Begruendung. Strukturiert (JSON) zurueck, Zod-validiert; Beispiel im Prompt: 'PV auf Schulen' vs. 'PV auf Spitaelern' = textlich aehnlich, KEINE Ueberlappung, Faktor 1.0. UMGESETZT 2026-07-08: phase-overlap-report.ts (Faktoren via callLlmJson/Secretary-Chat, Output-Chunks a 50; Prosa via /transformer/template mit editierbarem Template — User-Entscheid; Modell als Parameter, POST overlap-report/recompute)."
    status: completed
  - id: llm-overlap-persist
    content: "Stufe 3c — Persistenz als read-only KI-Einschaetzung analog bewertung_*: pro Massnahme korrektur_faktor_co2, korrektur_faktor_kosten, korrektur_ueberlappt_mit, korrektur_begruendung, korrektur_modell, korrektur_stand in docMetaJson (FLACHE snake_case-Keys, Frontmatter-Contract). Lauf ist idempotent wiederholbar; alter Stand wird ueberschrieben, korrektur_stand macht die Version sichtbar. UMGESETZT 2026-07-08: overlap-report-repo.ts (Berichte in overlap_reports, Faktoren via setDocOverlapFactors; Massnahmen ohne LLM-Faktor werden NICHT beschrieben)."
    status: completed
  - id: llm-sums-ui
    content: "Stufe 3d — UI: Tabellen-Fusszeile und Graph-Panel zeigen ZUSAETZLICH die LLM-bereinigte Summe (sum(wert_k * korrektur_faktor_k)) als dritte Zahl neben naiv und alpha-bereinigt, mit Datum/Modell aus korrektur_stand/korrektur_modell im Tooltip. Fehlen die Faktoren (Lauf nie ausgefuehrt / neue Docs ohne Faktor), wird die LLM-Summe NICHT angezeigt bzw. mit 'X ohne Faktor' gekennzeichnet — kein stilles Mischen von Massnahmen mit und ohne Korrektur. Spanne bleibt: naive Summe ist die Obergrenze."
    status: pending
  - id: llm-report-output
    content: "Stufe 3e — Bericht-Ausgabe (User-Wunsch 2026-07-08): der LLM-Lauf liefert neben den maschinenlesbaren Faktoren einen menschenlesbaren BERICHT (Markdown, persistiert neben dem Lauf): (1) uebersichtliche Ergebnis-Tabelle — pro Massnahme Nr, Titel, CO2 naiv, Faktor, CO2 bereinigt, Kosten naiv, Kosten-Faktor, Kosten bereinigt, ueberlappt-mit, Kurzbegruendung; am Ende die Summenzeile (naiv vs. bereinigt). (2) Prosa-Zusammenfassung (Executive Summary): Themenfelder/Cluster benennen und erklaeren, Groessenordnungen einordnen (welche Cluster tragen wie viel kt, wo liegen die grossen Hebel), Handlungsempfehlungen ('was waere jetzt zu tun' — z.B. welche Massnahmen-Buendel zuerst, wo Buendelung Kosten spart). Anzeige: eigener Tab/Abschnitt (z.B. im Graph- oder Berichts-Bereich) mit Markdown-Renderer; Export als Markdown-Datei moeglich. UMGESETZT 2026-07-08: Tabelle+Summen deterministisch in Code (overlap-report-build.ts), Prosa via /transformer/template (editierbares Template overlap-report-template.ts, context=strukturiertes JSON, model=Parameter); UI overlap-report-dialog.tsx (Fusszeile + Graph-Panel, Markdown-Anzeige, .md-Download, Neu-berechnen)."
    status: completed
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

## Methodik (Stufe 3 — LLM-Overlap-Bericht)

Stufe 3 behebt genau diese Grenze: statt thematische Naehe pauschal (alpha)
als Ueberlappung zu interpretieren, entscheidet ein Long-Context-LLM-Lauf
(1M Token) pro Massnahme FACHLICH, ob eine Ueberlappung vorliegt.

Ablauf (User-Entscheid 2026-07-08):

1. Export: der gefilterte Bestand (z.B. 606 Klimamassnahmen) wird absteigend
   nach co2_einsparung_kt sortiert und als kompakte Tabelle in den Kontext
   gegeben (Nr, Titel, Kurzbeschreibung, CO2, Kosten). Auswahl per
   Wirkungs-Schwelle/Top-N — es bleiben die wirkungsrelevanten (~100)
   Massnahmen; Massnahmen ohne CO2-Angabe werden als eigener Abschnitt
   ausgewiesen (no-silent-fallbacks), nicht still verworfen.
2. Das LLM vergibt pro Massnahme — in Listenreihenfolge, also GREEDY
   konsistent zu Stufe 2 — Korrekturfaktoren [0..1] relativ zu den bereits
   gezaehlten Massnahmen weiter oben: korrektur_faktor_co2 (Doppelzaehlung)
   und korrektur_faktor_kosten (Kosten-Synergien), je mit Begruendung und
   Liste der ueberlappenden massnahme_nrs. Beispielanker im Prompt:
   "PV auf Schulen" vs. "PV auf Spitaelern" = aehnlich, KEINE Ueberlappung,
   Faktor 1.0.
3. Bereinigte Summe Stufe 3 = sum(wert_k * korrektur_faktor_k) — dieselbe
   Formel wie Stufe 2, nur mit LLM-Urteil statt (1 - alpha*s_kj)-Produkt.
   Die Similarity-Kanten aus Stufe 2 dienen als Pruef-Hinweise im Prompt,
   beschraenken das LLM aber nicht (es darf eigene Cluster erkennen).

Der Lauf liefert ZWEI Artefakte (User-Wunsch 2026-07-08): die
maschinenlesbaren Faktoren (fuer die Summen in Fusszeile/Panel) UND einen
menschenlesbaren Markdown-Bericht — uebersichtliche Ergebnis-Tabelle
(naiv/Faktor/bereinigt je Massnahme, Summenzeile) plus Prosa-Summary, die
Themenfelder/Cluster erklaert, Groessenordnungen einordnet und
Handlungsempfehlungen gibt ("was waere jetzt zu tun"). Details Todo
llm-report-output.

GRENZE Stufe 3 (ebenfalls transparent machen): auch LLM-Urteile sind
Schaetzungen. Deshalb Begruendungspflicht pro Faktor, korrektur_modell +
korrektur_stand persistieren (versioniert, wiederholbar), Stichproben-Review
durch Menschen; die naive Summe bleibt als Obergrenze immer sichtbar.
Wirkung und Kosten sind semantisch VERSCHIEDEN zu korrigieren: Wirkung =
Doppelzaehlung geteilter Emissionen (Abzug wegen Ueberschneidung), Kosten =
Synergie durch Buendelung (Abzug wegen gemeinsamer Infrastruktur/Beschaffung)
— getrennte Faktoren, getrennte Begruendungen.

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
