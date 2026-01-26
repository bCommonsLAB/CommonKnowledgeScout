## Integrationstests (PDF & Audio)

### Was ist das?

Integrationstests validieren **End-to-End Use-Cases** über das echte External-Job-System:

- **Orchestrator** startet Jobs, wartet auf Abschluss, validiert Contracts
- **Shadow‑Twin** Artefakte werden über `ShadowTwinService` geprüft (storage-agnostisch)
- Testläufe werden **persistent** in MongoDB gespeichert (`integration_tests`) und sind in der UI unter `/integration-tests` sichtbar (inkl. Notes)

### Warum machen wir das?

- **Regression-Schutz** für Jobs/Contracts (z.B. `result.savedItemId`, Step-Status-Konsistenz)
- **Storage-Agnostik**: Tests müssen sowohl für Mongo-only als auch Filesystem/Provider funktionieren
- **Agent/CI-fähig**: Tests können per CLI gestartet, maschinell ausgewertet und als Notes dokumentiert werden

### Wie ist es gebaut? (Wichtige Bausteine)

- **Testcases (Suite)**: `src/lib/integration-tests/test-cases.ts`
  - jedes Szenario hat eine `id` (z.B. `audio_transcription.happy_path`)
  - `target` (`pdf|audio`) steuert, welche Dateien im Ordner als Targets gelten
  - `phases` + `policies` steuern Extract/Template/Ingest Verhalten
  - `expected` beschreibt die Erwartungen (inkl. Transcript-Checks für Audio)
- **Orchestrator**: `src/lib/integration-tests/orchestrator.ts`
  - listet Testdateien im Ordner (PDF/AUDIO)
  - bereitet Pre-Conditions vor (`clean|exists|incomplete_frontmatter`)
  - erstellt Jobs via interner Create-Route und startet sie
- **Validatoren**: `src/lib/integration-tests/validators.ts`
  - prüfen globale Contracts und UseCase-spezifische Erwartungen
  - Audio: prüft `extract_audio` und (bei Extract-only) Transcript statt Transformation
- **UI**: `src/app/integration-tests/page.tsx`
  - Dateityp (PDF/AUDIO) + Datei-Auswahl (optional), Suite-Filter, Run-History + Notes

### Globale Qualitätsregeln (wichtig)

- **Leeres Markdown ist ein Fehler**:
  - `ShadowTwinService.upsertMarkdown()` wirft bei leerem/Whitespace Markdown.
  - Zusätzlich Defense-in-Depth in Stores/Repo.
  - Ziel: kein „completed Job“, der ein leeres Transcript/Artefakt persistiert.
- **Global Contract**:
  - `completed` darf keine `pending` Steps enthalten
  - `completed` darf keine `running` Steps enthalten

---

## Zielbild: One Pipeline, Many Sources

### Leitidee

Alle Quellen (PDF, Audio, Markdown/TXT, Website, CSV, …) durchlaufen **eine einheitliche Pipeline**:

1. **Normalize** (quellenspezifisch): Konvertiert die Quelle in **Canonical Markdown** (Text-only) + Frontmatter + Original-Rohdaten-Referenz
2. **Template** (einheitlich): Erzeugt/validiert strukturierendes Frontmatter (falls nicht schon vollständig)
3. **Ingest** (einheitlich): Schreibt Vektoren/Meta in MongoDB Vector Search

### Canonical Markdown (gemeinsame Repräsentation)

Jede Quelle wird zuerst in ein **kanonisches Markdown-Format** normalisiert:

- **Text-only**: Reiner Markdown-Text (keine Asset-Downloads im Normalize-Schritt)
- **Frontmatter verpflichtend**: Quelle, Titel, Datum/Crawl-Zeit, Typ, Origin-Ref
- **Lossless Origin**: Original-Rohdaten (HTML/CSV/TXT/MD) werden zusätzlich als Artefakt gespeichert/verlinkt
- **Bilder/Assets**: Zunächst nur Links/Refs; Asset-Download als späteres Add-on (klar abgrenzen)

### Test-Matrix (Format × Phasen)

| Format | Normalize | Template | Ingest | Status |
|--------|-----------|----------|--------|--------|
| PDF | Extract → Transcript-MD | ✅ | ✅ | ✅ Implementiert |
| Audio | Transcribe → Transcript-MD | ✅ | ✅ | ✅ Implementiert |
| Markdown | Normalize (trim, Frontmatter erzwingen) | ✅ | ✅ | 🚧 In Arbeit |
| TXT | Wrap → Markdown + Frontmatter | ✅ | ✅ | 🚧 Geplant |
| Website | Fetch HTML → HTML→MD + Frontmatter | ✅ | ✅ | 🚧 Geplant |
| CSV | Parse → Markdown-Tabellen + Frontmatter | ✅ | ✅ | 🚧 Geplant |

### Globale Contracts (für alle Formate)

Jeder Integrationstest prüft dieselben **globalen Contracts**:

- **Canonical Markdown non-empty**: Normalize-Schritt darf kein leeres/Whitespace-Markdown erzeugen
- **Template Output**: Transformation erzeugt Markdown mit (mindestens) Frontmatter
- **Ingest Vectors**: `chunksUpserted > 0` und Meta/Chunks existieren in Vector Search
- **Job Contracts**: `completed` Jobs haben keine `pending`/`running` Steps

### Architektur-Details

Detaillierte Architektur-/Trade-off-Analyse siehe: [`docs/analysis/unified-pipeline-architecture.md`](../analysis/unified-pipeline-architecture.md)

---

## Ausführen (UI)

1. Öffne `/integration-tests`
2. Wähle **Dateityp** (PDF oder Audio)
3. Optional: wähle eine konkrete Datei (sonst: alle Dateien im Ordner)
4. Wähle Suite (z.B. „Nur Audio“) und starte den Run
5. Öffne einen Run in der History und lies Results/Notes

---

## Ausführen (CLI)

### Voraussetzungen

- Next Dev Server läuft (`pnpm dev`)
- Secretary Service ist erreichbar (je nach Setup lokal, z.B. `http://127.0.0.1:5001`)
- MongoDB ist erreichbar (für Run-History + Notes)

### Beispiel: Audio-Ordner (Testfolder)

```bash
pnpm -s test:integration:api -- \
  --libraryId 7911fdb9-8608-4b24-908b-022a4015cbca \
  --folderId YXVkaW8vdGVzdA== \
  --userEmail peter.aichner@crystal-design.com \
  --fileKind audio \
  --testCaseIds audio_transcription.happy_path,audio_transcription.gate_skip_extract,audio_transcription.force_recompute
```

Das Kommando gibt JSON aus (inkl. `runId`, Summary, per-Test Validation Messages).

---

## Agent-Playbook (damit der Agent „genau weiß, was zu tun ist“)

### Zieldefinition (Definition of Done)

- Run-Summary: **failed = 0**
- Keine globalen Contract-Fehler (z.B. `completed` mit `running` Steps)
- Für Audio: Transcript-Checks erfüllen die Schwellenwerte (`minTranscriptChars`, etc.)

### Ablauf (Loop)

1. **Run starten** (CLI oder UI)
2. **Ergebnis auswerten**
   - Wenn `failed > 0`: Fehler-Cluster nach Häufigkeit bilden (Validator-Messages)
3. **Analyse + Next Steps persistieren**
   - Entweder via API (wenn `INTERNAL_TEST_TOKEN` vorhanden)
   - Oder direkt via DB-Script:

```bash
node --import tsx scripts/post-integration-note.ts <runId>
```

4. **Minimalen Fix implementieren** (1 Ursache → 1 Fix)
5. **Suite erneut ausführen**
6. Wiederholen bis DoD erfüllt

Wichtig: Änderungen an Validatoren/Testcases gelten als Code-Änderungen und sollten wie Feature-Code getestet werden (Unit + Integration).

### Methode: „Agent Loop“ mit persistenter Protokollierung (Was/Wie/Warum)

Das Verfahren ist absichtlich so gebaut, dass ein Agent **ohne UI** in eine Iterationsschleife gehen kann und dabei jeden Schritt **persistiert**:

- **Was wird persistiert?**
  - Jeder Testlauf ist ein Run in der MongoDB-Collection `integration_tests` (Run-History).
  - Jeder Run enthält `result.summary` + `result.results[]` (inkl. `jobId` und Validator-Messages).
  - Zusätzlich können `notes[]` an einen Run angehängt werden (Analyse + Next Steps pro Iteration).

- **Warum persistieren wir das?**
  - Debugbarkeit: man kann alte Runs und „warum wurde was gefixt“ später nachvollziehen.
  - Agenten-Loop: der Agent hat eine stabile Quelle der Wahrheit (DB), nicht nur flüchtige Console-Ausgabe.
  - Reproduzierbarkeit: jeder Zyklus hat eine Run-ID, an die man sich „anhängen“ kann.

- **Wie kommt der Agent an die Run-ID?**
  - CLI: `pnpm -s test:integration:api ...` gibt direkt JSON aus (inkl. `runId`).
  - Server-Log: `POST /api/integration-tests/run` loggt zusätzlich eine einzeilige Marker-Zeile:
    - `[INTEGRATION_TEST_RUN] {"runId":"...","summary":{...}}`

#### Ablauf eines Zyklus (deterministisch)

1. **Run starten** (CLI oder UI)
2. **Run-ID + Result speichern** (passiert automatisch in `integration_tests`)
3. **Fehler clustern** (typisch: nach `ValidationMessage.type === "error"` und gleicher Message)
4. **Analyse/Next Steps als Note persistieren**
   - **Variante A (HTTP, wenn `INTERNAL_TEST_TOKEN` gesetzt ist)**:
     - `POST /api/integration-tests/runs/<runId>/analyze` (auto)
     - oder `POST /api/integration-tests/runs/<runId>/notes` (manuell/agent)
   - **Variante B (ohne Token, direkt in Mongo)**:

```bash
node --import tsx scripts/post-integration-note.ts <runId>
```

5. **Minimalen Fix implementieren**
   - Regel: 1 Fehler-Cluster → 1 minimaler Fix
   - Danach Unit-Tests für den betroffenen Bereich laufen lassen (mindestens die direkt betroffenen)
6. **Suite erneut ausführen**
7. **Wiederholen**, bis DoD erfüllt ist (failed=0 + Contracts ok)

#### Konvention für Notes (damit der Verlauf lesbar bleibt)

- Eine Note pro Zyklus, mit:
  - **Titel**: z.B. `Cycle N: Fix <kurz>` oder `Auto-Analyse: <x> Fehler`
  - **Analyse**: warum ist es ein Fehler, wo liegt wahrscheinlich die Ursache, welche Dateien sind betroffen
  - **Next Steps**: konkrete ToDos (klein, ausführbar, mit Tests)

---

## Neue Szenarien ergänzen

### 1) Testcase hinzufügen (minimal)

In `src/lib/integration-tests/test-cases.ts`:

- neue `id` nach Schema `<useCaseId>.<scenarioId>`
- `target`: `pdf` oder `audio`
- `phases` + `policies`
- `shadowTwinState` (wenn Pre-Condition nötig)
- `expected`:
  - PDF: typischerweise Transformation/ShadowTwin Existence, optional Ingestion
  - Audio (Extract-only): `expectTranscriptNonEmpty` + `minTranscriptChars`

### 2) Pre-Condition sicherstellen (falls nötig)

`src/lib/integration-tests/pdf-upload.ts` (historischer Name, enthält generische Helpers):

- `clean`: löscht deterministisch (Mongo + Filesystem)
- `exists`: erzeugt deterministische Artefakte via `ShadowTwinService.upsertMarkdown()`
- `incomplete_frontmatter`: erzeugt „kaputtes“ Artefakt für Repair-Szenarien

Wenn ein neues Szenario einen anderen Startzustand braucht, erweitere hier die Vorbereitung.

### 3) Validator erweitern (falls nötig)

`src/lib/integration-tests/validators.ts`:

- neue Assertions in `validateExternalJobForTestCase()`
- bevorzugt: über **Job-Step Details**, `ShadowTwinService.getMarkdown()` und globale Contracts
- vermeide Filesystem-Annahmen (Dot-Folder), wenn `persistToFilesystem=false` möglich ist

### 4) Tests hinzufügen

- Unit-Tests für neue Domain-Regeln/Validator-Logik:
  - z.B. `tests/unit/shadow-twin/shadow-twin-service.test.ts`
  - z.B. `tests/unit/integration-tests/*.test.ts`

---

## Referenzen

- `docs/analysis/integration-tests-agent-mode.md`
- `docs/analysis/integration-tests-storage-agnostic.md`
- `docs/analysis/audio-integration-tests.md`
- `docs/analysis/unified-pipeline-architecture.md`: Detaillierte Architektur für einheitliche Pipeline

