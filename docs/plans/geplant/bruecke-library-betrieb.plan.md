---
name: bruecke-library-betrieb
overview: "Eine Library über die MCP-Brücke betreiben, nicht nur ihr Archiv pflegen. Abgeleitet aus dem Live-Test der Status-Modalität (07./08.10.2026): Konfiguration setzen, Antwortqualität messen, Index nachziehen, Bestand prüfen, Läufe bilanzieren. Fünf wiederkehrende Use Cases, je ein bis zwei Werkzeuge, alle als Hülle um Funktionen, die das UI schon nutzt."
vorhaben: []
status: gebaut
todos:
  - id: welle-a-sehen
    content: "Welle A Sehen (Use Case 4 und 5, rein lesend): `dokumente_auflisten` (Galerie-Sicht über findDocs mit Facettenwerten, Filter, Suche, Seiten), `batch_bilanz` (Zähler je Batch aus ExternalJobsRepository, Fehler nach letztem Fehlergrund gruppiert, betroffene Quellen) und `bestand_pruefen` (doppelte Kennung nach Feld aus der Konfiguration, Werte außerhalb des Facetten-Wörterbuchs, fehlende Pflichtfelder des Typs, Einträge aus Twin-/Testordnern; Befundliste mit sourceIds, direkt an index_entfernen oder dokument_felder_setzen weiterreichbar). Dient auch dem Plan veranstaltungen-ueber-die-bruecke (Station 7). ERLEDIGT 08.10.: tools-bestand.ts, tools-batch-bilanz.ts, bestand-pruefung.ts, batch-bilanz.ts, bestand-filter.ts, doc-meta-liste.ts, docs-suchfilter.ts (Route und Brücke), 2.38.0."
    status: completed
  - id: welle-c-index
    content: "Welle C Index folgt dem Twin (Use Case 3): Zaun als GEMEINSAME Funktion (Twin-Ordner `_…` und `test/` ausschließen, nennt Übersprungenes), die der Batch-Dialog „Verzeichnis verarbeiten“ UND die Brücke aufrufen (Owner 08.10.; heute hat keiner von beiden einen Zaun); `index_aktualisieren` in Job-Form (nur Phase 3 mit vorhandener Transformation; sourceIds bis 30 ODER ordner + rekursiv; batchId zurück); `index_entfernen` als Stapel-Form von dokument_depublizieren; `dokument_felder_setzen` zieht die Chunk-Felder nach (Wiederverwendung: Nachzug der Facettenwerte aus dem Meta-Dokument, Commit cf25f18); `batch_neustart` über start-batch mit Filter Status/batchId (retry-batch antwortet 410). ERLEDIGT 08.10.: batch-zaun.ts (Dialog und Brücke), enqueue-ingest-job.ts, ordner-quellen.ts, tools-index.ts, tools-batch-neustart.ts, requeueForRestart, patchChunkFelder, 2.39.0."
    status: completed
  - id: welle-d-konfiguration
    content: "Welle D Konfiguration (Use Case 1): Validierung der Chat-Konfiguration (chatConfigSchema mit Platzhalter-Querprüfung aus src/lib/chat/config.ts) in ein Modul ziehen, das PATCH-Route UND Brücke nutzen (Muster public-publishing-validation.ts, 2.34.0) — heute prüft nur das Formular im Browser, die PATCH-Route parst ungeprüft; dann `konfiguration_lesen` und `konfiguration_setzen` (Bereiche facetten | antwortregeln | chat | galerie | veroeffentlichung, Teil-Update; Facetten in der JSON-Form des Import/Export). ERLEDIGT 08.10.: chat-config-validation.ts (PATCH-Route antwortet 400), konfiguration-bereiche.ts, tools-konfiguration.ts, 2.40.0."
    status: completed
  - id: welle-f-messen
    content: "Welle F Messen (Use Case 2, nach D): `golden_set_fahren` und `frage_stellen` mit Richter als JOB (Kern aus scripts/golden-set-run.ts in eine Service-Funktion ziehen; rund 36 s je Frage sprengen die 60-Sekunden-Grenze der Brücke; Start liefert jobId, Bericht als Markdown über job_status), Schalter ohneCache und baseline; `frage_log_lesen` über die Query-Route api/chat/[libraryId]/queries/[queryId]. Setzt das echte Golden-Set bei der Library voraus (Owner, Plan story-status-modalitaet §5a). ERLEDIGT 08.10.: golden-set/kontext.ts + lauf.ts (Skript nutzt den Service), bruecke-frage.ts, enqueue-golden-set.ts + phase-golden-set.ts (Start-Route 202 + detached, pushLog), tools-messen.ts, job_status.ergebnis, 2.41.0."
    status: completed
  - id: querschnitt-regeln
    content: "Querschnitt je Welle: dieselbe Service-Funktion wie das UI (ADR 0007), schreibende Werkzeuge nur nach Bestätigung mit Protokoll-Eintrag (protokoll.ts), Stapelgrenze 30, Fehler je Zeile statt Abbruch; TOOLSET_VERSION, TOOL_NAMES und NEU_IN_VERSION in tools-info.ts; Tests unter tests/unit/mcp/; neue Funktionen in eigene Module (vector-repo.ts hat 2.026 Zeilen); Zeile für src/lib/mcp/** im Routing-Index von CLAUDE.md; Konzept-Doku in einer neuen Datei docs/concepts/mcp-library-betrieb.md statt in mcp-storage-stand.md (Befund-Dokument der Versionen 2.10/2.11). ERLEDIGT 08.10.: Konzept docs/concepts/mcp-library-betrieb.md, Zeile im Routing-Index, 21 Testdateien unter tests/unit/; Live-Nachweis gegen eine echte Library OFFEN."
    status: completed
  - id: welle-i-verlaesslichkeit
    content: "Welle I Verlässlichkeit der Brücke (Owner 11.10.2026, aus dem Live-Prüffall der Veranstaltung über die Brücke, Archiv Tests/2026-10-11 Handover Veranstaltung Neuaufbau.md Abschnitt 9): I1 Transformieren und Ingest trennen (transformation_starten, quelle_erschliessen mit Vorlage, sammeldatei_anlegen bekommen ingest: boolean, Vorgabe false, sichtbar in der Antwort mit naechsterSchritt index_aktualisieren; Skill-Stationen 5 Transformieren, 6 Prüfen, 7 Freigabe trennen); I2 Text-Feed ehrlich (enqueue-secretary-job.ts: Job während des Feeds nicht claimbar, failed nur bedingt, nie über einen Job mit abgeschlossenen Schritten); I3 Fehlertexte vollständig (template-run.ts 600-Zeichen-Schnitt, responseDataPreview ohne Request-Echo, job-fehler-details jüngste Ereignisse, fetch-with-timeout cause, fehlerDeutung für secretary_abbruch, kein_llm_aufruf, text_feed_failed, abschluss_verweigert); I4 Zaun abgleichen (kein neuer Zaun in Einzelwerkzeugen, weil Ingest nie automatisch passiert, Owner 11.10.; nur bestand-pruefung.ts auf die gemeinsame Funktion und Startordner in ordner-quellen.ts prüfen). Zwei PRs: I1+I2 (2.46.0), I3+I4 (2.46.1). Detail in §3a."
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
| **I Verlässlichkeit** | `transformation_starten`, `quelle_erschliessen`, `sammeldatei_anlegen` + `ingest`; Text-Feed; `job_status` Fehlertexte und `fehlerDeutung`; Zaun-Abgleich | jede Library, jeder Lauf; Mensch entscheidet vor der Galerie | B, C, H; Live-Prüffall 11.10. (Archiv) | dieser, §3a |

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

## 3a. Welle I Verlässlichkeit der Brücke (Owner 11.10.2026)

**Anlass.** Der Live-Prüffall des Veranstaltungs-Plans lief am 08.–11.10.
über die Brücke (Werkzeugsatz 2.45.0, Library „Neuaufbau" des Dachverbands;
Handover mit Code-Prüfung im Archiv: `24.09 KnowledgeScout/Tests/2026-10-11
Handover Veranstaltung Neuaufbau.md`, Abschnitt 9). Vier Befunde betreffen
jede Library bei jedem Lauf, nicht nur Veranstaltungen:

1. `transformation_starten` ingestiert IMMER mit. Der Skill verspricht in
   Station 7 eine Freigabe vor der Veröffentlichung; tatsächlich steht die
   Seite nach Station 5 in der Galerie. Owner 11.10.: „Das ist eine
   Übergehung von Keep the Human in the Loop." Die Oberfläche kann es längst
   (Ingest-Haken im Pipeline-Sheet, Vorgabe aus).
2. Ein Job stand auf `failed`, obwohl Transformation und Ingest fertig
   waren. Ursache: der Text-Feed der Brücke setzt bei „fetch failed"
   bedingungslos `failed`, während die Callback-Route weiterrechnet; und der
   Job ist während des Feeds `queued`, der Worker kann ihn parallel claimen.
3. Fehlermeldungen kommen gekürzt an (600 Zeichen), die Antwort-Vorschau
   ist vom Request-Echo belegt, `fehlerDeutung` kennt nur eine Art.
4. Eine Testkopie unter `test/` lief in die Galerie, weil
   `transformation_starten` mit ingestierte. Mit I1 verschwindet die
   Ursache; der Zaun bleibt, wo er ist (Batch, `index_aktualisieren`
   Ordnerweg, `kopieren`).

**Entscheidungen (Owner 11.10.):**

- **Ingest ist ein eigener, bewusster Schritt.** Transformieren legt die
  Transformation am Twin ab; der Mensch prüft in der KS-Oberfläche; erst
  `index_aktualisieren` bringt die Seite in die Galerie. Die Vorgabe von
  `ingest` ist `false` und steht sichtbar in der Antwort (Muster
  `nurPublizierte`, 2.45.0), kein stiller Default.
- **Kein Sonderfall für `test/` in Einzelwerkzeugen.** Ingest passiert nie
  automatisch, sondern ist die bewusste Entscheidung des Anwenders
  (`ingest: true`). Wer eine Testkopie ingestiert, hat es so gewollt. Der
  Zaun bleibt bei den Sammel-Werkzeugen (Ordnerweg), wo niemand jede Quelle
  einzeln nennt.
- **Die Callback-Route bleibt synchron.** Welle I baut die Semantik von
  `POST /api/external/jobs/[jobId]` nicht um; sie macht den Feed ehrlich.

### I1 Transformieren und Ingest trennen

- `transformation_starten`, `quelle_erschliessen` (nur mit Vorlage, nicht
  `nur_transkript`) und `sammeldatei_anlegen` (wenn es transformiert)
  bekommen `ingest: z.boolean().optional()`; Weglassen = `false`, und die
  Antwort nennt `ingest` samt Herkunft (`aufruf` | `vorgabe`) und
  `naechsterSchritt` („Transformation liegt am Twin; in der KS-Oberfläche
  prüfen; dann `index_aktualisieren` mit sourceIds").
- Job-Bauer in `src/lib/external-jobs/enqueue-secretary-job.ts`
  (`buildSourceTranscribeJob`, `buildTemplateOnTextJob`) und
  `enqueue-markdown-job.ts` nehmen `ingest` als Argument und setzen
  `phases.ingest` und `policies.ingest` daraus. Die Werte aus
  `transform-optionen.ts` bleiben unberührt.
- `job_status` zeigt den Schritt `ingest_rag` bei abgeschaltetem Ingest als
  „übersprungen (abgeschaltet)", nicht als Fehler (`job-schritte.ts`
  prüfen). `abdeckung_lesen` zeigt den Zwischenzustand „Transformation ja,
  Galerie-Eintrag nein" (Test ergänzen).
- Skill `veranstaltung-aufbereiten`: Station 5 Transformieren (`ingest:
  false`), Station 6 Prüfen in der KS-Oberfläche (Markdown und Frontmatter
  der Transformation; Haltepunkt, der Mensch sagt „freigegeben"), Station 7
  Freigabe = `index_aktualisieren` mit den geprüften sourceIds, dann die
  bisherigen Prüfpunkte. Fehlerbilder ergänzen: Ingest-Haken im
  Pipeline-Sheet ist aus; „aborted" nach 2 Min = Secretary, nicht Vorlage;
  `failed` trotz Ingest completed = Text-Feed (bis I2 gebaut ist).
- `tools-info.ts`: 2.46.0, `NEU_IN_VERSION`.

### I2 Text-Feed ehrlich

- `fuettereTextImHintergrund` in `enqueue-secretary-job.ts:224-255`:
  (a) Der Job darf während des Feeds nicht vom Worker claimbar sein, bevor
  die Callback-Route ihn auf `running` setzt (Status beim Anlegen oder ein
  Claim-Marker; Muster `requeueAfterStartFailure`/`claim` im Repository
  prüfen, Reaper darf ihn nicht einsammeln). (b) `meldeFuetterFehler` setzt
  `failed` nur BEDINGT: nie über einen Job, der `running` ist oder
  abgeschlossene Schritte hat. `ExternalJobsRepository.setStatus` bekommt
  dafür eine Variante mit Vorbedingung (`$set` nur bei `status: queued`),
  statt den bedingungslosen Aufruf zu erweitern. (c) Der Feed-`fetch`
  bekommt eine ausdrückliche Zeitgrenze oberhalb von
  `EXTERNAL_TEMPLATE_TIMEOUT_MS` plus Ingest, und ein Ablauf wird als
  `text_feed_timeout` mit Deutung vermerkt, nicht als `failed`.
- Folge: „Abschluss verweigert" in `finalize-completion.ts:91-93` tritt
  für diesen Weg nicht mehr auf. Test: Feed scheitert nach abgeschlossenem
  Ingest → Status bleibt `completed`, Ereignis im Trace.
- Nicht anfassen: Worker→`/start` (PR #366), Watchdog, Start-Sperre.

### I3 Fehlertexte vollständig

- `template-run.ts:47` (`findeFehlerKlartext`): keine Kürzung auf 600
  Zeichen; `responseDataPreview` in `phase-template.ts:1120-1124` ohne das
  `request`-Echo (dasselbe, was `beschreibeAntwort` schon tut);
  `job-fehler-details.ts`: die JÜNGSTEN fünf Fehlerereignisse statt der
  ersten, `step_failed` mit `error` als Objekt lesbar; `fetch-with-timeout.ts:46`
  übernimmt `e.cause`; `adapter.ts:141-142` behält `error.code`.
- `fehler-deutung.ts`: neue Arten `secretary_abbruch` („aborted", „fetch
  failed", Timeout → Zeitlimit beim Secretary oder Anbieter, nicht die
  Vorlage), `kein_llm_aufruf` (TEMPLATE_TRANSFORMATION_ERROR mit „0
  LLM-Aufrufe" → Secretary-Konfiguration oder Modell), `text_feed_failed`,
  `abschluss_verweigert`. `job_status` wendet die Deutung auch auf
  `job.error` an, nicht nur auf `meldung`/`antwortAuszug`
  (`tools-jobs.ts:42-45`); `batch_bilanz` deutet den ungekürzten Schlüssel.
- Tests: `fehler-deutung.test.ts`, `job-fehler-details.test.ts` erweitern.

### I4 Zaun abgleichen (klein)

- Kein neuer Zaun in `quelle_erschliessen`, `transformation_starten`,
  `dokument_publizieren`, `sammeldatei_anlegen` oder `index_aktualisieren`
  mit `sourceIds` (Owner 11.10., siehe Entscheidungen).
- `bestand-pruefung.ts:42-47` (`istTwinOderTestPfad`) auf
  `istVomBatchAusgeschlossen` aus `src/lib/pipeline/batch-zaun.ts`
  umstellen (kennt dann auch `tests`); `ordner-quellen.ts` prüft den
  Startordner selbst, nicht nur Unterordner.
- Test: `bestand-pruefung.test.ts` und `ordner-quellen.test.ts` erweitern.

**Zuschnitt.** Zwei PRs: I1 + I2 (beide an `enqueue-secretary-job.ts` und
der Status-Semantik; 2.46.0), I3 + I4 (2.46.1). Je PR unter 5.000 Zeilen,
`pnpm test`, `pnpm lint`, `npx tsc --noEmit` ohne neue Zeilen; vor Merge
`bash scripts/welle-pre-merge-check.sh` und `pnpm build` lokal.

**Stand 11.10. (abends): I1 + I2 gebaut** (Branch
`claude/welle-i-bruecke-verlaesslichkeit`, 2.46.0; Konzept-Nachtrag in
`docs/concepts/mcp-library-betrieb.md`). Drei Abweichungen vom Text oben:
(a) Der Text-Job wird ab Anlage als `running` mit Schritten angelegt statt
über einen Claim-Marker; die Vorbedingung für `failed` ist darum „`running`
und kein Schritt über `pending` hinaus" (`job-unberuehrt-filter.ts`,
`setFailedIfUntouched`), nicht `status: queued`. (b) Die Zeitgrenze läuft
über `node:http` (`text-feed-transport.ts`), weil das globale `fetch` nach
300 s still abbricht und keine höhere Grenze zulässt. (c) `abdeckung_lesen`
kennt den Galerie-Stand nicht (Archiv-Seite, Twins); der Zwischenzustand ist
in `job_status` (`ingest_rag` „abgeschaltet") und in
`dokumente_auflisten`/`bestand_pruefen` sichtbar — dort kein neuer Test.
`enqueue-document-job.ts` nimmt `ingest` ebenfalls (Weg PDF/Office in
`quelle_erschliessen`), sonst wäre die Vorgabe dort still geblieben.

**Stand 11.10. (spät): I3 + I4 gebaut** (Branch
`claude/welle-i3-i4-fehlertexte-zaun`, gestapelt auf I1 + I2; 2.46.1).
Abweichungen: `fetch-with-timeout.ts` nimmt die Ursache nicht nur an
`cause`, sondern auch in den Text („fetch failed (ECONNREFUSED …)"), weil
Trace und `job.error` nur Strings tragen. `job-fehler-details.ts` liest
`error`-Objekte als „[code] message Details: {…}" und liefert die
jüngsten fünf in zeitlicher Reihenfolge (das letzte Element ist der letzte
Fehlschlag; `batch_bilanz` nutzt es als Ursache). `secretary_abbruch` ist
bewusst breit (aborted, fetch failed, timed out, UND_ERR_*_TIMEOUT), aber
nachrangig: `text_feed_failed` und `abschluss_verweigert` werden vorher
geprüft, weil ihre Meldungen „fetch failed" enthalten können. Der Zaun am
Startordner (`ordner-quellen.ts`) wirft einen Fehler mit Hinweis auf
`sourceIds` statt einer leeren Liste. Signatur für `kein_llm_aufruf`: Code
`TEMPLATE_TRANSFORMATION_ERROR` UND „0 LLM-Aufrufe"/„llm_calls: 0"; die
genaue Formulierung des Secretary ist im Repo nicht belegt, beim Live-Lauf
gegenprüfen.

**Live-Prüffall (Owner, Library „Neuaufbau" 72a883a0…):**
`transformation_starten` auf `04 Diskussion.md` ohne `ingest` → Antwort
nennt `ingest: false (vorgabe)` und den nächsten Schritt; `abdeckung_lesen`
zeigt Transformation ohne Galerie-Eintrag; nach Prüfung
`index_aktualisieren` → Eintrag da, Slug unverändert. Corbo (58 Folien)
erneut: `job_status` endet nicht auf `failed`, wenn der Ingest fertig ist;
bei Abbruch nennt `fehlerDeutung` den Secretary. Testkopie unter `test/`:
`transformation_starten` ohne `ingest` erzeugt keinen Galerie-Eintrag.

**Stop-Bedingungen zusätzlich:** Umbau der Callback-Route auf asynchron;
Änderung an Worker-Dispatch oder Start-Sperre; ein Default für `ingest`,
der nicht in der Antwort steht.

**Hand-off für den Start:**

- Branch `claude/welle-i-bruecke-verlaesslichkeit` von `master`.
- Modell: Opus, Thinking medium für I1 + I2 (Status-Semantik über
  Repository, Feed und Route hinweg); Sonnet, Thinking medium für I3 + I4
  (Muster vorhanden, Tests nachziehen).
- Neuer Agent je PR. Start-Prompt:

  > Lies CLAUDE.md, AGENTS.md, docs/STAND.md und
  > docs/plans/geplant/bruecke-library-betrieb.plan.md §3a (Welle I). Baue
  > I1 und I2 als EINEN PR auf Branch
  > `claude/welle-i-bruecke-verlaesslichkeit`: `ingest`-Parameter in
  > transformation_starten, quelle_erschliessen, sammeldatei_anlegen
  > (Vorgabe false, sichtbar in der Antwort, naechsterSchritt), Job-Bauer in
  > enqueue-secretary-job.ts und enqueue-markdown-job.ts; Text-Feed ehrlich
  > (nicht claimbar, failed nur bedingt, Zeitgrenze); Skill
  > veranstaltung-aufbereiten Stationen 5/6/7 trennen; tools-info.ts 2.46.0.
  > Contracts: contracts-pipeline, no-silent-fallbacks. Tests unter
  > tests/unit/mcp und tests/unit/external-jobs; pnpm test, pnpm lint,
  > npx tsc --noEmit ohne neue Zeilen. Hand-off-Block am Ende nach
  > docs/agents-handbuch.md §5.

- Kosten grob: I1 + I2 rund 8 bis 12 USD, I3 + I4 rund 5 bis 8 USD im
  Cloud-Agent; `pnpm build` nur lokal beim Owner.

**Live-Prüffall 11.10. abends gefahren (Produktion 2.46.1, Library
„Neuaufbau"):** alle Prüfpunkte bestanden (Archiv, Handover Abschnitte 10
und 11). Owner-Entscheid dabei: `slug` aus allen Vorlagen der Library
entfernt; ohne `slug` vom Modell bleibt der Slug am Twin stehen (Merge-Basis
ist das bestehende Frontmatter), Fallback aus dem Artefaktnamen nur bei der
ersten Transformation. Freigabe mit Slug-Rücksetzung über
`dokument_felder_setzen`, dann `index_aktualisieren`. Welle I ist damit
abgeschlossen.

## 3b. Welle J Lesersicht: Folienbilder, Cover, PDF-Anhänge (Owner 11.10.2026)

**Anlass.** Nach Welle I stehen die fünf Seiten der Journalistenschulung
mit guten Texten in der Galerie, aber ohne Bilder: 58 (Corbo) und 22
(Britsko) Folienbilder laden nicht, vier von fünf Seiten haben kein Cover,
PDF-Anhänge fehlen oder enden in 404 (Handover Abschnitt 2 „Bilder", Code-
Punkte 4.1 bis 4.4, Vorlagen 5). Das Handover hatte diese Befunde als
„Paket 1" ausgeklammert; sie waren bis 11.10. keinem Plan zugeordnet.

**Befund der Code-Prüfung 11.10. (Stand master 1.2.299):** Die Kette ist
länger als „Pfad relativ zur Wurzel":

1. `phase-template.ts` schreibt `slides` (Liste von Objekten) als JSON-
   **String** ins Frontmatter (flaches Frontmatter, AGENTS.md). Beim
   Ingest liest `ingestion-service.ts` das Frontmatter des Twins, prüft
   `Array.isArray(slides)` (Zeilen 171, 213) und findet einen String: der
   Session-Modus greift nicht, die Folienbild-Verarbeitung (Zeilen 213 bis
   264, `resolveSlideImagesFromTwinFragments`, Azure-Upload) läuft nie.
   `normalizeJsonStringValues` (`frontmatter.ts:148`) existiert, wird aber
   beim Lesen am Ingest nicht angewandt.
2. Selbst als Liste würde `slide-image-resolver.ts` nackte Namen
   (`preview_001.jpg`) nur gegen die `binaryFragments` der **Sammeldatei**
   auflösen (`getShadowTwinBinaryFragments(libraryId, fileId)`). Die
   Seitenbilder gehören aber zum Twin der **Folien-PDF** aus
   `_source_files`; die PDF-Extraktion legt sie dort als Fragmente mit
   `variant: 'page-render'` ab (`extract-only.ts:524`). Der Cover-Weg kennt
   das Muster schon: `fragmentUrlForRef` löst `_Quelle.pdf/name.jpg` über
   `findSourceFileMatchingTwinFolder` auf (`ingestion-service.ts`, FALL B).
   Seit Welle E steht die Liste der Quellen als `compositeSources` am Twin.
3. `event-slides.tsx` baut aus einem nackten Namen eine `streaming-url`
   mit base64 des Namens relativ zur Library-Wurzel; das ist der HTTP 400
   aus dem Handover. Absolute URLs reicht die Komponente durch.
4. `coverImageUrl` bleibt leer, weil die Vorlage den Namen aus
   „Verfügbare Medien" erwartet und diese Liste keine `preview_00N.jpg`
   enthält; `attachments_url` ebenso. Das sind Modell-Felder ohne Quelle.

**Entscheidungen (Owner 11.10.):**

- Bilder und Anhänge sind **Sache der Pipeline, nicht des Modells**. Die
  Vorlage liefert Seitenzahlen und Texte; welche Datei zu Seite N gehört
  und wo sie öffentlich liegt, rechnet der Ingest.
- Das Frontmatter bleibt flach: `slides` als JSON-String im Twin ist der
  Speicher-Vertrag; wer liest, parst. Im Meta-Dokument (MongoDB) ist
  `slides` eine Liste mit absoluten Bild-URLs.

### J1 Slides beim Ingest als Liste lesen

- `ingestion-service.ts`: `metaEffective` vor der Session-Erkennung durch
  `normalizeJsonStringValues` schicken (oder gezielt `slides`,
  `attachments_url`, `galleryImageUrls` mit `tryParseFrontmatterValue`).
  Danach greifen Session-Modus und Folienbild-Verarbeitung.
- Test: Twin-Frontmatter mit `slides: "[{...}]"` als String → Session-Modus
  erkannt, `result.slides` Liste.

### J2 Folienbilder gegen die Quellen-Twins auflösen

- `slide-image-resolver.ts`: Fragmente nicht nur der Sammeldatei, sondern
  aller `compositeSources` des Twins (Vorrang: Quelle mit `.pdf`, dann
  Reihenfolge der `_source_files`). Nackter Name → URL des `page-render`-
  Fragments gleichen Namens. Unaufgelöste Namen bleiben wie heute in
  `unresolved` und im Trace (`slide_images_unresolved`), kein stiller
  Platzhalter.
- Prüfen: heißen die Fragmente der PDF-Extraktion `preview_NNN.jpg` wie in
  den Twin-Ordnern? Sonst Abbildung Seitenzahl → Fragmentname über
  `page_num`.
- `event-slides.tsx`: absolute URL durchreichen; nackter Name ohne Auflösung
  wird als „Bild nicht aufgelöst" gezeigt, nicht als Wurzel-Pfad geraten
  (no-silent-fallbacks).
- Prüfkriterium: Corbo 58 und Britsko 22 Folienbilder laden im Browser.

**Stand 11.10.2026 (PR 1, J1 + J2 + Viewer gebaut):** Die Fragmente der
PDF-Extraktion heißen am Twin `preview_NNN.jpeg` (thumbnail) und
`page_NNN.jpeg` (page-render), beide mit `pageNumber`; der Direct-Upload
normalisiert `jpg` zu `jpeg`. Die Vorlage nennt `preview_NNN.jpg`, deshalb
ordnet der Resolver zuerst über den exakten Namen, dann über die Seitenzahl
aus dem Namen (Vorrang der Variante nach Präfix), und ohne `image_url` über
`page_num` (thumbnail vor page-render). Suchreihenfolge: eigener Twin, dann
PDF-Quellen aus `compositeSources` (die mit den meisten Seitenbildern zuerst,
damit ein Flyer nicht die Folien verdrängt), dann übrige Quellen. Der Ingest
parst gezielt `slides`, `galleryImageUrls`, `attachments_url`,
`attachments_names` aus JSON-Text (`frontmatter-json-lists.ts`), nicht
pauschal alle Strings. Trace: `slide_images_resolved` (mit Quellen) und
`slide_images_unresolved`; `upsertMarkdown` gibt `slideImages` zurück, das
`index_aktualisieren` in J5 als `bilder` meldet. Live-Prüffall Corbo/Britsko
steht aus (Owner).

**Stand 11.10.2026 (J3 + J4 + J5 gebaut; auf Owner-Wunsch mit J1 + J2 in EINER PR #372, zwei Commits):**
Cover: `cover-aus-quellen.ts` nimmt die zweite Seite der Folien-PDF
(page-render als Cover, thumbnail als Vorschau), sonst die erste, sonst den
Flyer (Name mit flyer/einladung); ein erzeugtes Cover entsteht weiterhin in
der Template-Phase und steht dann schon im Frontmatter, der Ingest fasst es
nicht an. Anhänge: `anhaenge-aus-quellen.ts` listet die PDF-Quellen (Folien,
Unterlagen, Flyer zuletzt) als Dateinamen; der bestehende Blob-Schritt des
Ingests hebt sie über die `sourceId` in den Blob (öffentliche Adresse; die
Streaming-URL verlangt Anmeldung und kam deshalb nicht in Frage), Markdown-
Links auf PDF-Namen werden auf dieselbe Adresse umgeschrieben. Rückschreiben
ins Twin-Frontmatter bewusst nicht: das Meta-Dokument ist die Lesersicht, der
Twin bleibt Modellausgabe. Abweichung zu J5: `index_aktualisieren` antwortet
sofort mit Job-Ids, die Bilanz entsteht erst im Job; deshalb zeigt
`job_status` am Schritt `ingest_rag` das Feld `bilder`, nicht die Antwort von
`index_aktualisieren` (die nennt den Weg). Werkzeugsatz 2.47.0. Live-Prüffall
alle fünf Seiten (Cover, Flyer-PDF aus dem Rückblick) beim Owner offen.

**Live-Prüffall 11.10.2026 abends (Owner in Cowork, Library „Neuaufbau",
`events/Journalisten Schulung`):** Werkzeugsatz 2.47.0 bestätigt, fünf
Index-Jobs grün, aber `bilder` bei Corbo 0/58 und Britsko 0/22, alle Namen
`preview_NNN.jpg` unaufgelöst, Cover und Anhänge leer. Befund in Mongo (nur
lesen): Die PDF-Twins tragen nur die OCR-Bilder (`img-N.jpeg`, 9 bzw. 8), kein
einziges Fragment mit `variant`/`pageNumber`. Der Extraktions-Trace zeigt
den Grund: `pages.zip` kam an und wurde hochgeladen (174 bzw. 66 Bilder),
aber `zipArchivesPassed: 0, ranDirectUpload: false` — im Filesystem-Modus
(`persistToFilesystem` true, Strategie `azure-with-fs-backup`) sammelt
`extract-only.ts` die Archive nicht für den Direct-Upload, die Seitenbilder
landen nur im Twin-Ordner des Storage und werden nie als `binaryFragments`
registriert. Die Namen `preview_001.jpg` … im Twin hat das Modell aus der
Vorlagenregel „Seite N gehört zu preview_NNN.jpg" gebildet („Verfügbare
Medien" zeigte nur `img-N.jpeg`).

**Nachzug (PR gleichen Tages):** (1) `extract-only.ts` registriert im
Filesystem-Modus nach dem Mongo-Speichern die Seitenbilder aus dem Twin-Ordner
(`extract-page-images-register.ts`, derselbe Weg wie `register-image-fragments`
der Sync-Engine: `reconstructPageImages`, Upsert je Name), Trace
`extract_only_page_images_registered` / `_skipped` / `_error`. (2) Die
Nachregistrierung nennt Vorschauen `preview`, der Direct-Upload `thumbnail`;
`quellen-fragmente.ts` lässt beide als Vorschau gelten. Für bestehende Twins
(diese Library) ist der Weg `twins_pruefen` → Plan zeigt
`register-image-fragments` je PDF → `twins_synchronisieren` mit `repair`, dann
`index_aktualisieren`. **Zweiter Befund (Owner in Cowork, nach #374):**
`twins_pruefen` plante `register-image-fragments` bei keiner PDF, sondern nur
`delete-dead-page-md` (58/22/1 `page_NNN.de.md`); die Sync-Engine hielt
Twins mit irgendeinem Fragment für versorgt (`hasFragments ? 0`). Nachzug 2:
`zaehleRekonstruierbareSeitenbilder` zählt je Datei, ob sie schon als
Fragment steht. **Dritter Befund (Owner in Cowork, 11.10. spät):** Nach
Neu-Extraktion der drei PDFs (Weg 2) sind Corbo 58/58 und Britsko 22/22
aufgelöst, Anhänge stehen als Blob-Adressen, der Flyer-Link im Rückblick ist
umgeschrieben — aber kein Cover. Prod-Mongo: die nachregistrierten Fragmente
tragen `variant`, aber `pageNumber: null`, Trace `cover_source: none`.
`uploadBinaryFragment` nahm `pageNumber` im Typ an, speicherte es nie.
Nachzug 3: Service reicht `pageNumber` durch; `quellen-fragmente.ts` leitet
Seitennummer und Variante aus dem Namen ab, wenn sie fehlen, damit die
bereits registrierten Fragmente ohne erneute Extraktion reichen. Nebenbefund
offen: `dokumente_auflisten` zeigt
`coverImageUrl`, `attachments_url`, `slides` nicht (nur Facetten), und
`job_status` zeigt Trace-Ereignisse nur im Fehlerfall; beides erschwert die
Prüfung über die Brücke.

### J3 Cover automatisch

- Beim Ingest, wenn `coverImageUrl` leer: (1) zweite Seite der ersten
  Folien-PDF (`preview_002.jpg`), sonst erste; (2) erstes Bild des Flyers
  (Quelle mit `flyer`/`einladung` im Namen oder erste Nicht-Folien-PDF);
  (3) erzeugtes Cover nach Library-Einstellung „Cover-Bild automatisch
  generieren". Ergebnis als absolute URL in Meta-Dokument und Twin-
  Frontmatter, Herkunft im Trace (`cover_source: slides | flyer |
  generated`), nie still.
- Prüfkriterium: alle fünf Seiten der Journalistenschulung zeigen ein Cover
  in der Galerie.

### J4 PDF-Anhänge öffentlich

- `attachments_url` beim Ingest aus `compositeSources` füllen, wenn leer:
  alle PDF-Quellen (Reihenfolge: Folien, Unterlagen, Einladung), als
  abrufbare Adresse (Blob analog `bild_veroeffentlichen`, oder
  `streaming-url` mit der `fileId` der Quelle, nicht mit dem Namen);
  `attachments_names` weiter als Anzeigename. Markdown-Links auf PDF-Namen
  im Body auf dieselbe Adresse umschreiben.
- Prüfkriterium: Flyer-Link im Rückblick öffnet das PDF; Corbo-Seite listet
  die Folien-PDF unter „Dokumente & Links".

### J5 Vorlagen und Skill

- `vortrag-session-de`, `diskussion-de`, `veranstaltung-*-de`: Anweisungen
  zu `coverImageUrl`, `attachments_url` und `slides[].image_url` auf
  „Seitenzahl nennen, Datei rechnet die Pipeline" umstellen; feste
  Leerwerte (`coverImageUrl: ""`) raus, weil sie wörtlich landen.
- Skill `veranstaltung-aufbereiten`: Station 7 bekommt die Prüfpunkte
  „Cover sichtbar, Folienbilder laden, PDF-Anhang öffnet, keine leeren
  Überschriften"; `index_aktualisieren` nennt in der Antwort je Zeile
  `bilder: { aufgeloest, unaufgeloest }` (Werkzeugsatz 2.47.0,
  `NEU_IN_VERSION`).

**Nicht in dieser Welle:** Diarisierung (Handover 4.12), `standard-book`
an das Facetten-Vokabular binden (4.13), englische UI-Texte (4.14).

**Zuschnitt.** Zwei PRs: J1 + J2 + Viewer (Folien; Opus, Thinking medium,
weil Ingest, Resolver und Viewer zusammenhängen), J3 + J4 + J5 (Cover,
Anhänge, Vorlagen; Sonnet, Thinking medium). Je PR unter 5.000 Zeilen,
`pnpm test`, `pnpm lint`, `npx tsc --noEmit` ohne neue Zeilen (Vergleich
per Stash); vor Merge `bash scripts/welle-pre-merge-check.sh` und
`pnpm build` lokal. Tests unter `tests/unit/ingestion/` und
`tests/unit/components/`.

**Live-Prüffall (Owner, Library „Neuaufbau" 72a883a0…):** nach PR 1
`index_aktualisieren` mit den `sourceIds` von Corbo und Britsko → beide
Seiten zeigen alle Folienbilder; nach PR 2 `index_aktualisieren` für alle
fünf Seiten → Cover auf jeder Karte, Flyer-PDF öffnet aus dem Rückblick.

**Hand-off für den Start:**

- Branch `claude/welle-j-folienbilder` von `master`; neuer Agent je PR.
- Start-Prompt PR 1:

  > Lies CLAUDE.md, AGENTS.md, docs/STAND.md und
  > docs/plans/geplant/bruecke-library-betrieb.plan.md §3b (Welle J). Baue
  > J1 und J2 samt Viewer als EINEN PR auf Branch
  > `claude/welle-j-folienbilder` von master: Ingest liest `slides` aus dem
  > Twin-Frontmatter auch als JSON-String (normalizeJsonStringValues vor der
  > Session-Erkennung in ingestion-service.ts); slide-image-resolver.ts
  > löst nackte Namen gegen die page-render-Fragmente aller
  > compositeSources des Twins auf (Vorrang PDF-Quellen), unaufgelöste
  > Namen bleiben sichtbar; event-slides.tsx rät keinen Wurzel-Pfad mehr.
  > Prüfe zuerst, wie die Fragmente der PDF-Extraktion heißen
  > (extract-only.ts, variant page-render) und ob sie zu
  > `slides[].image_url` passen. Contracts: contracts-ingestion-chat,
  > contracts-templates-media, no-silent-fallbacks. Tests unter
  > tests/unit/ingestion und tests/unit/components; pnpm test, pnpm lint,
  > npx tsc --noEmit ohne neue Zeilen gegenüber master (Vergleich per
  > Stash). Im Worktree vorher pnpm install. Hand-off-Block nach
  > docs/agents-handbuch.md §5.

- Kosten grob: PR 1 rund 8 bis 12 USD, PR 2 rund 6 bis 9 USD im Cloud-
  Agent; `pnpm build` nur lokal beim Owner.

## 3c. Welle K Prüfbarkeit: die Brücke zeigt, was der Leser sieht (Owner 12.10.2026)

**Anlass.** Welle J brauchte drei Nachzüge (#374, #375, #376), und jeder
Befund kam erst aus dem Live-Prüffall, nie aus dem Bauen. Der Prüfer in
Cowork hat es als Advocatus Diaboli auf den Punkt gebracht: Das Ergebnis
lebt im Meta-Dokument und in der Galerie-Karte, kein Brückenwerkzeug zeigt
eines von beiden. Er sah Twin-Frontmatter (`coverImageUrl: ""`) und
Job-Zähler (`aufgeloest: 58`), meldete „OK", und der Owner sah in der
Galerie kein Cover. Dazu: Die Spezifikation 2.47.0 versprach Trace-
Ereignisse (`cover_source`, `attachments_source`, `slide_images_resolved`),
die der Server schreibt, die `job_status` aber nur im Fehlerfall zeigt;
`twins_pruefen` meldet für „keine Seitenbilder da" und „alle registriert"
dieselbe leere Liste; ein Ingest mit 0 von 58 Bildern war `completed`; und
ob ein Merge auf dem Server angekommen ist, sagt nur der Werkzeugsatz,
nicht die App-Version (`VERSION`, 1.2.303), die jeder Merge hebt.

**Lehre, die vor der Welle steht (Owner, 12.10.):** Eine Welle ist erst
abnehmbar, wenn ihr Prüfkriterium über die Brücke lesbar ist. Und der
Prüffall läuft vor dem Bauen einmal gegen den Ist-Zustand: Welle J hätte
mit einer Mongo-Abfrage begonnen („welche Fragmente tragen eine
Seitennummer?") und wäre in der Extraktion gelandet statt im Resolver.
Beide Sätze gehören ins Agenten-Handbuch (§1 Teststrategie), sobald Welle K
gebaut ist.

**Entscheidungen:** Alles lesend, nichts am Datenmodell außer einem
Stempel im Meta-Dokument. Der Job-Status bleibt `completed`; ein Befund ist
ein Feld, keine neue Statusart. Werkzeugsatz 2.48.0.

### K1 Lesersicht lesen `dokument_lesen`

- Neues Werkzeug in `tools-bestand.ts` (neben `dokumente_auflisten`):
  Eingabe `libraryId` und `sourceId` oder `pfad`. Antwort aus dem
  Meta-Dokument (`doc_meta__<libraryId>`, `kind: 'meta'`, über
  `getMetaByFileId`): `titel`, `detailViewType`, `coverImageUrl`,
  `coverThumbnailUrl`, `attachments_url` mit `attachments_names` als Paare,
  `folien: { anzahl, mitAdresse, ohneAdresse: [page_num] }`,
  `galleryImageUrls` (Anzahl), `upsertedAt`, `ingestedWith` (K5), dazu
  `galerieAdresse` (Pfad `/explore/<slug>/…`, wenn die Library öffentlich
  ist, sonst `null` mit Grund). Kein Markdown-Body (dafür `artefakt_lesen`).
- `dokumente_auflisten` bekommt den Schalter `lesersicht: true`, der je
  Zeile `cover` (ja/nein), `anhaenge` (Anzahl) und `folienMitAdresse/anzahl`
  nennt. Vorgabe false, die Antwort bleibt sonst wie heute.
- Prüfkriterium: `dokument_lesen` für 03 Vortrag Corbo zeigt dieselben
  Werte wie die Galerie-Karte und der Session-Detail (Cover-Adresse, 58
  Folien mit Adresse, 1 Anhang).

### K2 `job_status` zeigt die Ereignisse der Lesersicht

- `tools-jobs.ts`: neues Feld `ereignisse` mit den Trace-Ereignissen des
  Ingest-Spans aus einer festen Liste: `slide_images_resolved`,
  `slide_images_unresolved`, `cover_source`, `attachments_source`,
  `attachments_links_rewritten`, `extract_only_page_images_registered`,
  `extract_only_page_images_skipped`, `extract_only_page_images_error`,
  `frontmatter_json_list_invalid`. Je Ereignis Name und Attribute, nicht
  der ganze Trace. Eigene Datei `job-ereignisse.ts` (200-Zeilen-Regel),
  derselbe Weg wie `fehlerDetailsAusTrace`.
- `batch_bilanz` nennt je Zeile `coverQuelle` (`slides | flyer | none`) und
  `folien: { aufgeloest, unaufgeloest }` aus denselben Ereignissen.
- Prüfkriterium: `job_status` des Corbo-Index-Jobs nennt
  `cover_source: slides, page: 2` und `slide_images_resolved: 58`.

### K3 Befunde statt stummem `completed`

- `job_status` und `batch_bilanz` bekommen `befunde: string[]`, gerechnet
  aus Schrittdetails und Ereignissen: „Folien: N von M ohne Adresse
  (Namen)", „Cover: keine Quelle (Grund)", „Anhänge: keine PDF-Quelle,
  obwohl compositeSources PDFs enthält", „Transformation übersprungen
  (Grund)" (der bisherige `nichtsGeschrieben`-Hinweis wandert hierher, bleibt
  aber auch als Feld). Leere Liste heißt: nichts zu melden. Eigene Datei
  `job-befunde.ts`, reine Funktion mit Tests.
- `index_aktualisieren` und `transformation_starten` nennen im `hinweis`,
  dass `job_status` Befunde liefert.
- Prüfkriterium: Der Index-Job vom 11.10. (2abe2a40…, 0 von 58) hätte
  `befunde: ["Folien: 58 von 58 ohne Adresse …"]` gezeigt; ein Job nach
  #376 zeigt `befunde: []`.

### K4 Versionsstempel der Brücke

- `bruecke_info`: zusätzlich `appVersion` aus der Datei `VERSION` im
  Repo-Root (beim Start gelesen, im Docker-Image vorhanden; fehlt sie,
  `appVersion: null` mit Grund, kein Default) und `gebautAm`
  (Build-Zeitpunkt aus `process.env.BUILD_TIME`, wenn gesetzt). Damit ist
  „ist #376 drin?" eine Zeile: Merge-Commit „Bump version to 1.2.304" ⇒
  `appVersion ≥ 1.2.304`.
- `NEU_IN_VERSION` nennt künftig neben dem Werkzeugsatz auch die
  App-Version, ab der der Eintrag gilt.
- Prüfkriterium: `bruecke_info` auf Prod nennt die App-Version, die der
  jüngste Merge-Commit auf `master` gesetzt hat.

### K5 Stempel am Meta-Dokument und am Twin

- Ingest (`ingestion-service.ts`, beim Bau von `docMetaJsonObj`): Feld
  `ingestedWith: { toolset, app, at }`. `dokument_lesen` (K1) zeigt es;
  `dokumente_auflisten` mit `lesersicht` zeigt `app`.
- Transformation (`phase-template.ts`): neben `generated_by` (Contract
  §4.1) das Feld `generated_with` im Twin-Frontmatter, flach, Wert
  `knowledgescout/<app>/<toolset>`. `artefakt_lesen` zeigt es;
  `abhaengige_dokumente` nennt je Sammeldatei, ob die Transformation vor
  einer bestimmten App-Version lief (`aelterAls`).
- Prüfkriterium: Nach `index_aktualisieren` zeigt `dokument_lesen`
  `ingestedWith.app` = aktuelle App-Version; eine Seite, die seit dem
  Merge nicht lief, zeigt die ältere.

### K6 `twins_pruefen` unterscheidet Abwesenheit von Erledigung

- Je Quelle drei Zahlen: `fragmente` (am Twin), `seitenbilderAmTwin`
  (Fragmente mit Seitennummer), `seitenbilderImOrdner` (Dateien
  `preview_*`/`page_*` im Twin-Ordner). Geplant wird wie heute; die Zahlen
  stehen auch dann da, wenn nichts zu planen ist. Quelle:
  `collect-source-input.ts` sammelt sie schon, der Report
  (`sync-report`) reicht sie durch.
- Prüfkriterium: Für die Corbo-PDF nennt `twins_pruefen` nach #376 und
  Index-Lauf `fragmente: 125, seitenbilderAmTwin: 116,
  seitenbilderImOrdner: 116` und plant nichts; vor #374 hätte es
  `9 / 0 / 116` und `register-image-fragments: 116` gezeigt.

**Stand 12.10.2026 (PR 1, K1 + K2 + K3 gebaut, Werkzeugsatz 2.48.0):**
`dokument_lesen` (Registrierung in `tools-dokument-lesen.ts`, Mapping in
`lesersicht.ts`, von `registerBestandTools` aufgerufen — 200-Zeilen-Regel),
`dokumente_auflisten` mit `lesersicht`, `job_status` mit `ereignisse` und
`befunde` (`job-ereignisse.ts`, `job-befunde.ts`), `batch_bilanz` mit
`zeilen` je Job (`coverQuelle`, `folien`, `befunde`) und `mitBefund`;
`fehlerBlock` aus `tools-jobs.ts` nach `job-fehler-details.ts` verschoben.
Ist-Zustand vorher gelesen (Prod, nur lesend; Skript
`scripts/welle-k-ist-zustand-lesen.mjs`): Corbo-Index-Job `2abe2a40…` vom
11.10. 22:18 trägt `slide_images_resolved: 58`, `cover_source: none`
(„keine PDF-Quelle mit Seitenbildern"), `attachments_source: 1`; das
Meta-Dokument `coverImageUrl: ""`, `slides` als Liste (58, Blob-Adressen),
`attachments_url`/`attachments_names` als parallele Listen,
`galleryImageUrls: []`, `publication: null`, `slug` oben und im
`docMetaJson`. Der Job würde heute `befunde: ["Cover: keine Quelle (keine
PDF-Quelle mit Seitenbildern)"]` zeigen. Abweichungen zum Plan:
`frontmatter_json_list_invalid` ist eine Log-Phase, kein Trace-Ereignis — die
Ereignisliste nimmt Log-Phasen der festen Liste mit, wenn kein gleichnamiges
Trace-Ereignis steht; `ingestedWith` in `dokument_lesen` kommt mit K5. Der
Trace kennt zusätzlich `cover_preserve` (Carry-Forward eines alten Covers),
nicht in der Liste — ein Befund „Cover: keine Quelle" kann daher neben einem
bewahrten alten Cover stehen; falls das im Prüffall stört, in PR 2 ergänzen.
Live-Prüffall (fünf Seiten, `befunde: []` nach #376) beim Owner offen.

**Nicht in dieser Welle:** Status `completed mit Befund` als eigener
Job-Status (Befund bleibt Feld); `delete-dead-page-md` im Preset `repair`
überdenken (eigene Entscheidung, gehört zur Sync-Engine); Skill-Stationen
umschreiben (erst nach K1 bis K3, dann Station 7 auf `dokument_lesen` und
`befunde` umstellen).

**Zuschnitt.** Zwei PRs: PR 1 = K1 + K2 + K3 (Lesewerkzeug, Ereignisse,
Befunde; Sonnet, Thinking medium, weil reine Lese- und Mapping-Arbeit mit
klaren Vorbildern `job-fehler-details.ts`, `job-schritte.ts`,
`tools-bestand.ts`). PR 2 = K4 + K5 + K6 (Stempel, `twins_pruefen`;
Sonnet, Thinking medium). Werkzeugsatz 2.48.0 in PR 1, `NEU_IN_VERSION` in
beiden. Je PR unter 5.000 Zeilen, `pnpm test`, `pnpm lint`, `npx tsc
--noEmit` ohne neue Zeilen (Vergleich gegen master), Tests unter
`tests/unit/mcp/`; vor Merge `bash scripts/welle-pre-merge-check.sh`.

**Live-Prüffall (Owner in Cowork, Library „Neuaufbau", nach jedem PR):**
Nach PR 1: `dokument_lesen` für die fünf Seiten nennt Cover, Anhänge,
Folien mit Adresse; `job_status` der letzten Index-Jobs nennt
`ereignisse` und `befunde: []`. Nach PR 2: `bruecke_info` nennt die
App-Version des Merges; `dokument_lesen` zeigt `ingestedWith`;
`twins_pruefen` nennt die drei Zahlen. Erst dann die Regieanweisung von
Welle J ein letztes Mal, diesmal ohne Blick in die Galerie durch den Owner.

**Hand-off für den Start:**

- Branch `claude/welle-k-pruefbarkeit` von `master`; neuer Agent je PR.
- Start-Prompt PR 1:

  > Lies CLAUDE.md, AGENTS.md, docs/STAND.md und
  > docs/plans/geplant/bruecke-library-betrieb.plan.md §3b (Welle J, alle
  > Befunde) und §3c (Welle K). Baue K1, K2 und K3 als EINEN PR auf Branch
  > `claude/welle-k-pruefbarkeit` von master. K1: neues Werkzeug
  > dokument_lesen in src/lib/mcp/tools-bestand.ts (Meta-Dokument über
  > getMetaByFileId: coverImageUrl, coverThumbnailUrl, attachments als
  > Paare, folien { anzahl, mitAdresse, ohneAdresse }, galleryImageUrls,
  > upsertedAt, galerieAdresse oder null mit Grund), dokumente_auflisten mit
  > Schalter lesersicht. K2: job_status mit Feld ereignisse aus einer festen
  > Namensliste des Ingest-Spans (neue Datei src/lib/mcp/job-ereignisse.ts
  > nach dem Muster job-fehler-details.ts), batch_bilanz mit coverQuelle und
  > folien je Zeile. K3: job_status und batch_bilanz mit befunde: string[]
  > aus Schrittdetails und Ereignissen (neue Datei job-befunde.ts, reine
  > Funktion), Hinweise in index_aktualisieren und transformation_starten.
  > TOOLSET_VERSION 2.48.0, NEU_IN_VERSION, TOOL_NAMES in tools-info.ts.
  > Contracts: no-silent-fallbacks; Konzept docs/concepts/mcp-library-betrieb.md.
  > Zuerst den Ist-Zustand lesen: ein Index-Job in der Prod-DB
  > (external_jobs, Trace-Ereignisse des Ingest-Spans) und ein
  > Meta-Dokument (doc_meta__<libraryId>, kind meta), damit Feldnamen und
  > Formen stimmen; Prod nur lesen, Befehle für den Owner in PowerShell.
  > Tests unter tests/unit/mcp; pnpm test, pnpm lint, npx tsc --noEmit ohne
  > neue Zeilen gegenüber master. Im Worktree vorher .env kopieren und
  > pnpm install. Hand-off-Block nach docs/agents-handbuch.md §5.

- Start-Prompt PR 2 (nach Merge von PR 1):

  > Lies CLAUDE.md, AGENTS.md, docs/STAND.md und
  > docs/plans/geplant/bruecke-library-betrieb.plan.md §3c (Welle K). Baue
  > K4, K5 und K6 als EINEN PR auf Branch `claude/welle-k-stempel` von
  > master. K4: bruecke_info nennt appVersion aus der Datei VERSION im
  > Repo-Root (fehlt sie: null mit Grund) und gebautAm aus BUILD_TIME;
  > NEU_IN_VERSION nennt künftig Werkzeugsatz und App-Version. K5: Ingest
  > schreibt ingestedWith { toolset, app, at } ins Meta-Dokument
  > (ingestion-service.ts, docMetaJsonObj), phase-template.ts schreibt
  > generated_with flach ins Twin-Frontmatter; dokument_lesen,
  > dokumente_auflisten (lesersicht), artefakt_lesen und
  > abhaengige_dokumente (aelterAls) zeigen es. K6: twins_pruefen nennt je
  > Quelle fragmente, seitenbilderAmTwin, seitenbilderImOrdner aus
  > collect-source-input.ts über den Sync-Report. Frontmatter bleibt flach
  > (AGENTS.md). Contracts: shadow-twin-contracts §4.1, contracts-pipeline,
  > no-silent-fallbacks. Tests unter tests/unit/mcp und
  > tests/unit/shadow-twin; pnpm test, pnpm lint, npx tsc --noEmit ohne
  > neue Zeilen gegenüber master. Hand-off-Block nach
  > docs/agents-handbuch.md §5.

- Kosten grob: PR 1 rund 6 bis 9 USD, PR 2 rund 5 bis 8 USD im
  Cloud-Agent; `pnpm build` nur lokal beim Owner.

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

## 6. Stand 08.10.2026

Alle vier Wellen dieses Plans sind gebaut und mit Unit-Tests belegt
(Werkzeugsatz 2.38.0 bis 2.41.0, 15 neue Werkzeuge; Konzept in
[`docs/concepts/mcp-library-betrieb.md`](../../concepts/mcp-library-betrieb.md)).
Der Owner hat am 08.10. entschieden, die Wellen in einer Session
durchzuziehen und das Ergebnis danach zu prüfen. Offen:

- **Live-Nachweis** gegen eine echte Library über die Brücke (Desktop-App
  neu verbinden, `bruecke_info` muss 2.41.0 zeigen): `bestand_pruefen` mit
  `kennungsfeld`, `index_aktualisieren` auf einen kleinen Ordner,
  `golden_set_fahren` mit dem echten Set der Library (das Set selbst ist
  Owner-Arbeit, Plan story-status-modalitaet §5a).
- Die Wellen B, E, G, H liegen im Plan
  [`veranstaltungen-ueber-die-bruecke.plan.md`](veranstaltungen-ueber-die-bruecke.plan.md).

**Nachtrag 11.10.2026:** Der Live-Prüffall der Veranstaltung über die Brücke
ist gelaufen (Archiv, Handover mit Code-Prüfung). Daraus kommt **Welle I
Verlässlichkeit** (§3a, Owner-Entscheid: Ingest als bewusster Schritt,
Text-Feed ehrlich, Fehlertexte vollständig, Zaun abgleichen). Sie ist angelegt,
nicht gebaut. Die Lesersicht-Befunde desselben Prüffalls (Folienbilder,
Cover, PDF-Anhänge; „Paket 1") und der Kleinkram („Paket 3") sind im
Handover beschrieben und noch keinem Plan zugeordnet.
