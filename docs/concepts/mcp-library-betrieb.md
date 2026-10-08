# Library-Betrieb über die MCP-Brücke

Stand 08.10.2026, Werkzeugsatz **2.44.0** (2.42.0 Welle B, 2.43.0 Welle E, 2.44.0 Welle G aus dem Veranstaltungs-Plan, siehe unten; das Drehbuch ist der Skill `veranstaltung-aufbereiten`). Gebaut nach
[`docs/plans/geplant/bruecke-library-betrieb.plan.md`](../plans/geplant/bruecke-library-betrieb.plan.md)
(Wellen A, C, D, F). Die Brücke war bis 2.37.0 eine Archiv-Brücke: sie
pflegte Twins, Berichte und Website-Seiten. Seit 2.41.0 kann sie eine Library
auch **betreiben**: Bestand sehen, Läufe bilanzieren, Index nachziehen,
Konfiguration setzen, Antworten messen. Jedes Werkzeug ruft dieselbe
Funktion wie das UI (ADR 0007), keine zweite Logik.

## Die Werkzeuge je Use Case

| Use Case | Werkzeug | Liest/Schreibt | Dieselbe Funktion wie |
|---|---|---|---|
| **4 Bestand prüfen** | `dokumente_auflisten` | liest | Galerie-Route (`api/chat/[libraryId]/docs`): Typ-Scope, Facettenfilter, Suche (`docs-suchfilter.ts`), Galerie-Sortierung |
| | `bestand_pruefen` | liest | Regeln in `bestand-pruefung.ts`: doppelte Kennung (`kennungsfeld`), Werte außerhalb des Facetten-Wörterbuchs, fehlende Pflichtfelder des Typs (Registry), Twin-/test-Ordner (Quellordner des Twins) |
| **5 Läufe bilanzieren** | `batch_bilanz` | liest | `ExternalJobsRepository`, Fehlerdetails aus dem Job-Trace (`job-fehler-details.ts`), Deutung (`fehler-deutung.ts`) |
| | `batch_neustart` | schreibt | Neustart-Knopf im Job-Monitor (`start-batch`): `requeueForRestart` + Worker-Tick |
| **3 Index nachziehen** | `index_aktualisieren` | schreibt | Pipeline-Route, nur Phase 3: `enqueue-ingest-job.ts`, Start-Route-Pfad `runIngestOnly`; Zaun `batch-zaun.ts` wie der Batch-Dialog |
| | `index_entfernen` | schreibt | `depubliziereQuelle` (Stapel) |
| | `dokument_felder_setzen` | schreibt | zusätzlich `patchChunkFelder`: Chunks tragen dieselben Felder wie das Meta-Dokument |
| **1 Konfigurieren** | `konfiguration_lesen` | liest | `config.chat` je Bereich; Veröffentlichung wie `veroeffentlichung_lesen` |
| | `konfiguration_setzen` | schreibt | `chat-config-validation.ts` — dasselbe Zod-Schema wie das Settings-Formular, inkl. Platzhalter-Querprüfung; nutzt auch die PATCH-Route |
| **2 Messen** | `frage_stellen` | schreibt Query-Log | Stream-Route: `bruecke-frage.ts` (Filter, Retriever-Entscheidung, Regeln, Nachprüfung, Cache-Hash) |
| | `golden_set_fahren` | schreibt (Job) | `golden-set/lauf.ts` — derselbe Kern wie `scripts/golden-set-run.ts`; Phase `phase-golden-set.ts` |
| | `frage_log_lesen` | liest | `getQueryLogById` |

## Regeln, die alle Werkzeuge einhalten

- **Schreibende Werkzeuge nur nach Bestätigung**, mit `begruendung` im
  Aktions-Protokoll (`protokoll.ts`).
- **Stapelgrenze 30** (sourceIds), Ordner-Stapel bis 200; **Fehler je Zeile**
  statt Abbruch.
- **Kein stiller Default**: `bestand_pruefen` nennt Regeln, die nicht laufen
  konnten (kein `kennungsfeld`, kein Wörterbuch, Pfad nicht auflösbar);
  `konfiguration_setzen` weist Infrastruktur-Schlüssel (Embeddings, Vektor-Store,
  Modelle) laut ab; `batch_bilanz` wirft bei unbekanntem Job-Status.
- **Zaun** (Owner 08.10.): Twin-Ordner `_…` und `test/` betritt ein Stapel nie —
  Batch-Dialog „Verzeichnis verarbeiten" und `index_aktualisieren` nutzen
  dieselbe Funktion, unabhängig von der Filesystem-Persistierung.
- **60-Sekunden-Grenze der Brücke**: alles mit mehr als einem Modellaufruf
  läuft als Job (`golden_set_fahren`); `frage_stellen` ist eine Frage und
  bleibt synchron.
- **Modell aus der App**, nicht aus dem Aufruf (Standard-Modell; Owner-Entscheid
  28.08.2026).

## Der Ablauf nach dem Live-Test 07./08.10.

1. `bestand_pruefen` mit `kennungsfeld` (z. B. `massnahme_nr`) → Doppelgänger
   und Twin-/test-Einträge → `index_entfernen` mit den sourceIds.
2. `konfiguration_lesen` (facetten, antwortregeln) → Wörterbuch ergänzen,
   Regeln setzen → `konfiguration_setzen`; die Platzhalter-Prüfung weist
   Tippfehler ab, bevor der Chat sie sieht.
3. `golden_set_fahren` mit `baseline: true` (Vorher-Wert), dann ohne
   (Nachher-Wert); Bericht neben der Set-Datei, Einzelfragen über
   `frage_log_lesen`.
4. Nach neuer Facette: `index_aktualisieren` (ordner + rekursiv), dann
   `batch_bilanz`; Fehlergruppen gezielt mit `batch_neustart` (jobIds).

## Was absichtlich fehlt

- Rechte und Scopes des Konto-Schlüssels (offene Kante aus ADR 0008): die
  neuen Werkzeuge schreiben mit den vollen Rechten des Besitzers.
- Automatische Bereinigung: `bestand_pruefen` meldet, der Mensch entscheidet.
- Veröffentlichung setzen über `konfiguration_setzen`: bleibt bei
  `veroeffentlichung_setzen` (eigene Validierung, eigene Außenwirkung).
- Ein Live-Nachweis gegen eine echte Library — der Code ist mit Unit-Tests
  belegt, der Lauf über die Brücke steht aus (siehe Plan, Stand 08.10.).

## Nachtrag Welle B (2.42.0): zwei Wege der Audio-Erschliessung

Owner 08.10.: Beim Analysieren von Audio soll unterscheidbar sein, ob mit
Sprechererkennung gearbeitet wird oder ganz ohne, und im zweiten Fall das
Transkript danach von Hand geprüft wird. `quelle_erschliessen` nimmt dafür
`sprecherErkennung` (true, false, weglassen = Library-Voreinstellung), `kontext`
und `begriffe` (P3a) und nennt je Audio-Quelle den Weg, seine Herkunft
(aufruf, library, standard) und den nächsten Schritt; `wege` zählt den Stapel.
Beide Wege enden im Reiter „Korrektur" der KS-Oberfläche: einmal Sprecher und
Namen bestätigen, einmal Hörfehler von Hand prüfen. `job_status` zeigt den
Audio-Kontext am Job. P6 (`folienAlsTabelle`, `anhangInSuche`) gilt in
`quelle_erschliessen` und `transformation_starten`; nur explizite Booleans
landen im Job (`transform-optionen.ts`), fehlende Werte entscheidet sichtbar
die Library-Voreinstellung.

## Nachtrag Welle E (2.43.0): Einheiten bilden, Abhängige finden

Owner 08.10.: Die Abhängigkeit Sammeldatei → Quellen steht im Twin-Dokument
(`compositeSources`), geschrieben vom Transformations-Job beim Auflösen der
`_source_files` (Loader, beide Pfade). Damit ist „welche Sammeldateien
enthalten diese Quelle?" eine indizierte Mongo-Abfrage statt ein Vollscan.
`sammeldatei_anlegen` geht den Weg des Knopfs „Sammel-Transkript"
(`buildCompositeReference`), prüft Existenz und Transkript jeder Quelle und
überschreibt nichts; `sammeldatei_pruefen` nutzt den Nur-Prüfen-Modus des
Resolvers; `abhaengige_dokumente` liefert je Sammeldatei Vorlage, Sprache und
den Befund überholt (Transformation älter als `revised_at` der Quelle,
dieselbe Regel wie der Badge im Reiter „Korrektur"). Beide Korrektur-Wege
(Reiter, Route, `transkript_korrigieren`) und die Arbeitsliste von
`korrekturen_lesen` nennen die abhängigen Sammeldateien. Sammeldateien, die
vor Welle E zuletzt transformiert wurden, tragen das Feld erst nach dem
nächsten Lauf; für den Prüffall einmal `transformation_starten` erzwingen.

## Nachtrag Wellen G und H (2.44.0): Artefakte lesen, Drehbuch

`artefakt_lesen` liefert Transkript oder Transformation einer Quelle aus
MongoDB ohne Spiegel, Body ohne Frontmatter, auf `maxZeichen` gekürzt, mit
Übersicht der vorhandenen Artefakte. Damit kann ein Agent die Zuordnung der
Einheiten aus den Transkriptanfängen vorschlagen. Der Skill
`veranstaltung-aufbereiten` (`.claude/skills/`) ist das Drehbuch über alle
Werkzeuge: sieben Stationen plus Nachziehen, drei Rückfragen an den Menschen
und der Haltepunkt in Station 4, an dem der Mensch das Transkript im Reiter
„Korrektur" prüft.

**Nachtrag 2.44.1:** `transformation_starten` erkennt bei einer Sammeldatei
ein jüngeres Transkript einer ihrer Quellen (über `compositeSources`) und
erzwingt mit `erzwungen: "quelle_juenger"`. Vorher verglich der Server nur
das eigene Transkript der Sammeldatei und sagte nach einer Korrektur an einer
Quelle „aktuell". Testablauf für alle Wellen:
[`mcp-testszenario-library-betrieb.md`](mcp-testszenario-library-betrieb.md).
