---
name: bruecke-library-betrieb
overview: "Eine Library über die MCP-Brücke betreiben, nicht nur ihr Archiv pflegen. Abgeleitet aus dem Live-Test der Status-Modalität (07./08.10.2026): Konfiguration setzen, Antwortqualität messen, Index nachziehen, Bestand prüfen, Läufe bilanzieren. Fünf wiederkehrende Use Cases, je ein bis zwei Werkzeuge, alle als Hülle um Funktionen, die das UI schon nutzt."
vorhaben: []
status: geplant
todos:
  - id: welle-a-sehen
    content: "Welle A Sehen (Use Case 4 und 5, rein lesend): `dokumente_auflisten` (Galerie-Sicht über findDocs mit Facettenwerten, Filter, Suche, Seiten), `batch_bilanz` (Zähler je Batch aus ExternalJobsRepository, Fehler nach letztem Fehlergrund gruppiert, betroffene Quellen) und `bestand_pruefen` (doppelte Kennung nach Feld aus der Konfiguration, Werte außerhalb des Facetten-Wörterbuchs, fehlende Pflichtfelder des Typs, Einträge aus Twin-/Testordnern; Befundliste mit sourceIds, direkt an index_entfernen oder dokument_felder_setzen weiterreichbar). Dient auch dem Plan veranstaltungen-ueber-die-bruecke (Station 7)."
    status: pending
  - id: welle-c-index
    content: "Welle C Index folgt dem Twin (Use Case 3): Zaun als GEMEINSAME Funktion (Twin-Ordner `_…` und `test/` ausschließen, nennt Übersprungenes), die der Batch-Dialog „Verzeichnis verarbeiten“ UND die Brücke aufrufen (Owner 08.10.; heute hat keiner von beiden einen Zaun); `index_aktualisieren` in Job-Form (nur Phase 3 mit vorhandener Transformation; sourceIds bis 30 ODER ordner + rekursiv; batchId zurück); `index_entfernen` als Stapel-Form von dokument_depublizieren; `dokument_felder_setzen` zieht die Chunk-Felder nach (Wiederverwendung: Nachzug der Facettenwerte aus dem Meta-Dokument, Commit cf25f18); `batch_neustart` über start-batch mit Filter Status/batchId (retry-batch antwortet 410)."
    status: pending
  - id: welle-d-konfiguration
    content: "Welle D Konfiguration (Use Case 1): Validierung der Chat-Konfiguration (chatConfigSchema mit Platzhalter-Querprüfung aus src/lib/chat/config.ts) in ein Modul ziehen, das PATCH-Route UND Brücke nutzen (Muster public-publishing-validation.ts, 2.34.0) — heute prüft nur das Formular im Browser, die PATCH-Route parst ungeprüft; dann `konfiguration_lesen` und `konfiguration_setzen` (Bereiche facetten | antwortregeln | chat | galerie | veroeffentlichung, Teil-Update; Facetten in der JSON-Form des Import/Export)."
    status: pending
  - id: welle-f-messen
    content: "Welle F Messen (Use Case 2, nach D): `golden_set_fahren` und `frage_stellen` mit Richter als JOB (Kern aus scripts/golden-set-run.ts in eine Service-Funktion ziehen; rund 36 s je Frage sprengen die 60-Sekunden-Grenze der Brücke; Start liefert jobId, Bericht als Markdown über job_status), Schalter ohneCache und baseline; `frage_log_lesen` über die Query-Route api/chat/[libraryId]/queries/[queryId]. Setzt das echte Golden-Set bei der Library voraus (Owner, Plan story-status-modalitaet §5a)."
    status: pending
  - id: querschnitt-regeln
    content: "Querschnitt je Welle: dieselbe Service-Funktion wie das UI (ADR 0007), schreibende Werkzeuge nur nach Bestätigung mit Protokoll-Eintrag (protokoll.ts), Stapelgrenze 30, Fehler je Zeile statt Abbruch; TOOLSET_VERSION, TOOL_NAMES und NEU_IN_VERSION in tools-info.ts; Tests unter tests/unit/mcp/; neue Funktionen in eigene Module (vector-repo.ts hat 2.026 Zeilen); Zeile für src/lib/mcp/** im Routing-Index von CLAUDE.md; Konzept-Doku in einer neuen Datei docs/concepts/mcp-library-betrieb.md statt in mcp-storage-stand.md (Befund-Dokument der Versionen 2.10/2.11)."
    status: pending
---

# Library-Betrieb über die MCP-Brücke

## 1. Anlass

Am 07./08.10.2026 wurde die Status-Modalität des Story-Modus
(`story-status-modalitaet.plan.md`) in einer Library live getestet. Jeder
Schritt lief über das UI oder direkt gegen die App-API: Wörterbuch und
Antwortregeln in den Settings, Fragen im Story-Modus, Query-Logs per
Browser, Re-Ingest über den Batch-Dialog, Bereinigung der Nebenwirkungen
(Doppelgänger, Freitext-Werte) per Hand. Die Brücke (Stand 2.37.0, 46
Werkzeuge) konnte davon nur einen Teil: Felder setzen und einzelne Einträge
zurücknehmen. Sie ist eine Archiv-Brücke, keine Betriebs-Brücke.

Der Owner will dieselbe Kette künftig über die Brücke fahren. Nicht als
Nachbau der Klima-Sitzung, sondern als wiederverwendbare Use Cases, die bei
jeder Library wiederkommen: beim Aufsetzen (Dachverband, AECED), beim
Nachschärfen der Antworten, nach jedem Batch.

## 2. Die fünf Use Cases

| Use Case | Wann er wiederkommt | Heute | Brücke (neu) | Brücke (da) |
|---|---|---|---|---|
| **1 Konfigurieren** | Library aufsetzen, Facette anlegen, Antwortregeln ändern, Vorlage wechseln | Settings-UI, PATCH Library | `konfiguration_lesen`, `konfiguration_setzen` | — |
| **2 Messen** | Nach jeder Regel-, Wörterbuch- oder Vorlagenänderung; Baseline vor einem Hebel | Story-UI, Query-Log im Browser, `scripts/golden-set-run.ts` | `frage_stellen`, `frage_log_lesen`, `golden_set_fahren` | — |
| **3 Index nachziehen** | Facette nachträglich angelegt, Template geändert, Twin korrigiert | Batch-Dialog „Verzeichnis verarbeiten", `ingest-markdown` je Datei | `index_aktualisieren`, `index_entfernen` (Stapel) | `dokument_depublizieren` (einzeln), `dokument_felder_setzen` (ohne Chunks) |
| **4 Bestand prüfen** | Nach jedem Batch, vor jeder Veröffentlichung | `docs`-API im Browser, Storage-Pfade per Hand | `dokumente_auflisten`, `bestand_pruefen` | `abdeckung_lesen`, `twins_pruefen` (Archiv-Seite, nicht Index-Seite) |
| **5 Läufe bilanzieren** | Nach jedem Batch, bei Fehlern | Job-Monitor, `counters`-API | `batch_bilanz`, `batch_neustart` | `job_liste`, `job_status`, `jobs_aufraeumen`, `job_abbrechen` |

Was sich im Test als Muster gezeigt hat und in die Werkzeuge gehört:

- **Konfiguration ist Vertrag.** Ein Platzhalter auf eine unbekannte Facette
  wurde im Formular rot und blockierte das Speichern. Die Brücke muss
  dieselbe Prüfung fahren, sonst steht der Chat der Library (no-silent-fallbacks).
- **Messen vor Ändern.** Die Baseline wurde im Test übersprungen, weil die
  Settings zuerst gefüllt waren. `golden_set_fahren` braucht den Schalter
  `baseline` (Modell ohne Wörterbuch und Regeln, Prüfung mit vollem Schema),
  damit der Vorher-Wert auch nachträglich messbar ist.
- **Index folgt dem Twin.** Der Twin ist die Wahrheit, der Index ein
  Abbild. Jede Korrektur am Twin (Feld setzen) muss den Index nachziehen
  können, sonst laufen Meta-Dokument, Chunks und Vorspann auseinander.
- **Batch braucht Zaun.** Der Batch-Dialog hat Twin-Ordner (`_…`) und
  einen `test/`-Ordner mitgenommen, daraus wurden 29 Doppelgänger.
  `index_aktualisieren` schließt beide aus und nennt, was es übersprang.
- **Fehler nach Ursache, nicht nach Zahl.** 33 Jobs standen auf
  „Worker-Timeout"; die Ursache war „kein Twin". `batch_bilanz` gruppiert
  nach dem letzten Fehlergrund und listet die Quellen, damit ein Neustart
  nur dort passiert, wo er etwas bringt.

## 3. Wellen (Owner 08.10.2026, gemeinsam mit `veranstaltungen-ueber-die-bruecke`)

Sortiert nach Allgemeinheit: Was jede Library bei jedem Lauf braucht, kommt
zuerst; was nur Sammeldateien und Veranstaltungen brauchen, kommt später.
Die Buchstaben gelten in beiden Plänen.

| Welle | Werkzeuge | Wer braucht es | Vorbedingung | Plan |
|---|---|---|---|---|
| **A Sehen** | `dokumente_auflisten`, `batch_bilanz`, `bestand_pruefen` | jede Library, nach jedem Batch, vor jeder Veröffentlichung | keine, rein lesend | dieser |
| **B Optionen durchreichen** | `quelle_erschliessen` + Sprecher, Kontext, Begriffe; `transformation_starten` + Folien-Tabelle, Anhang-Suche | jedes Erschließen, jedes Transformieren | Job-Bauer in `enqueue-secretary-job.ts` | Veranstaltungen |
| **C Index folgt dem Twin** | Zaun (gemeinsam), `index_aktualisieren`, `index_entfernen`, Chunk-Nachzug, `batch_neustart` | jede Library nach jeder Korrektur, Facette, Vorlage | Entscheidung Zaun (getroffen) | dieser |
| **D Konfiguration** | Validierungsmodul für Route und Brücke, `konfiguration_lesen`, `konfiguration_setzen` | jedes Aufsetzen, jede Facette, jede Regeländerung | keine | dieser |
| **E Einheiten** | `sammeldatei_anlegen`, `sammeldatei_pruefen`, `abhaengige_dokumente` | alles mit Sammeldateien | Entscheidung Abhängigkeit im Twin-Dokument (getroffen) | Veranstaltungen |
| **F Messen** | `frage_stellen`, `golden_set_fahren` als Job, `frage_log_lesen` | Chat-Libraries nach jeder Regeländerung | D; echtes Golden-Set bei der Library | dieser |
| **G Helfer** | `artefakt_lesen` | Agent ohne Spiegel | keine | Veranstaltungen |
| **H Drehbuch** | Skill `veranstaltung-aufbereiten` | wiederholbarer Ablauf | A bis E | Veranstaltungen |

Jede Welle ist ein eigener PR (eine Welle mit Entscheidung darf zwei sein)
mit Integrationstest gegen die Test-Library
(`external-jobs-integration-tests`), Diff-Grenzen nach
`refactor-batch-strategy`.

**Entscheidungen 08.10.2026 (Owner):**

- **Zaun gemeinsam.** Der Ausschluss von Twin-Ordnern (`_…`) und `test/`
  wird eine Funktion, die der Batch-Dialog im UI und `index_aktualisieren`
  in der Brücke beide aufrufen. Nur in der Brücke hätte der Dialog weiter
  Doppelgänger erzeugt und gegen „dieselbe Funktion wie das UI" verstoßen.
- **Abhängigkeit im Twin-Dokument** (Welle E, Detail im
  Veranstaltungs-Plan): der Transformations-Job schreibt die Quellen-Ids
  einer Sammeldatei nach MongoDB, statt dass `abhaengige_dokumente` alle
  Sammeldateien aus dem Storage liest.
- **Der Prüfschritt des Menschen bleibt in der KS-Oberfläche.** Kein
  Brücken-Werkzeug für Korrekturvorschläge; `kosten_schaetzen` entfällt.

**Befunde der Code-Prüfung 08.10.2026** (Stand master 1.2.289, Brücke 2.37.0):

- Alle in §5 genannten Bausteine existieren. Die 60-Sekunden-Grenze der
  Brücke (dokumentiert in `enqueue-secretary-job.ts`) zwingt Use Case 2 in
  die Job-Form.
- Die Platzhalter-Querprüfung (`chatConfigSchema.superRefine`) läuft heute
  nur im Formular-Hook und beim Lesen in der Stream-Route; die PATCH-Route
  der Library prüft nicht. Welle D schließt das.
- Es gibt im Code keinen Zaun, weder in `api/pipeline/process` noch im
  Batch-Dialog.
- `retry-batch` ist abgeschaltet (410); der Knopf im Job-Monitor nutzt
  `start-batch` mit Status- und batchId-Filter.
- Für den Chunk-Nachzug liegt mit Commit cf25f18 (Facettenwerte aus dem
  Meta-Dokument in ältere Chunks) bereits Code auf master.

## 4. Was nicht in diesen Plan gehört

- Rechte und Scopes des Konto-Schlüssels (offene Kante aus ADR 0008): die
  neuen Werkzeuge schreiben mit den vollen Rechten des Besitzers, wie alle
  anderen. Eine Scope-Trennung „nur lesen" wäre ein eigener Plan.
- Eine Galerie-Sicht in der Brücke, die Bilder oder Layout liefert.
  `dokumente_auflisten` gibt Felder, keine Karten.
- Automatische Bereinigung. `bestand_pruefen` meldet, der Mensch entscheidet.

## 5. Betroffene Dateien

- `src/lib/mcp/tools-*.ts` (ein Modul je Welle), `tools-info.ts`
  (Changelog, `TOOL_NAMES`), neu `docs/concepts/mcp-library-betrieb.md`,
  eine Zeile im Routing-Index von `CLAUDE.md`
- Wiederverwendet: `src/lib/chat/config.ts` (Zod der Konfiguration),
  `src/lib/chat/orchestrator.ts`, `src/lib/chat/golden-set/*`,
  `scripts/golden-set-run.ts` (Kern in eine Service-Funktion ziehen),
  `src/app/api/pipeline/process` (Job-Anlage; Zaun als gemeinsame Funktion
  für Batch-Dialog und Brücke), `src/app/api/external/jobs/start-batch`
  (`batch_neustart`), `src/app/api/chat/[libraryId]/queries/[queryId]`
  (`frage_log_lesen`), `src/lib/repositories/vector-repo.ts`
  (`findDocs`, `deleteVectorsByFileId`; neue Funktionen in eigene Module),
  `src/lib/repositories/doc-meta-felder.ts`, Chunk-Nachzug aus Commit cf25f18
