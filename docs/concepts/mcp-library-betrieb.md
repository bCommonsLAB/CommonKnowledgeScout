# Library-Betrieb über die MCP-Brücke

Stand 08.10.2026, Werkzeugsatz **2.41.0**. Gebaut nach
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
