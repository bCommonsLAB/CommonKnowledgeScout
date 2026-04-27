# Cloud-Agent-Brief: Welle 3 — Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent als Pre-Flight fuer Welle 3,
direkt nach erfolgreicher Welle 2 (`shadow-twin`).

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md)
   - insbesondere R1-R5 (kein Push auf master ohne User-OK, kein Parallelismus).
2. **Vorbild-Wellen**: [`docs/refactor/external-jobs/`](../external-jobs/) (Pilot),
   [`docs/refactor/storage/`](../storage/) (Welle 1) und
   [`docs/refactor/shadow-twin/`](../shadow-twin/) (Welle 2). Welle 2 ist die
   **direkteste Vorlage** — gleicher Ablauf, gleiche Doku-Struktur.
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
   Sektion 5 Welle 1 Backend (Modul `ingestion` als 3. von 3 Backend-Modulen).
4. **Repo-Konventionen**: [`AGENTS.md`](../../../AGENTS.md).
5. **Inventur** (schon erstellt): [`01-inventory.md`](./01-inventory.md).

## Aufgabe

Du bist **EIN** Cloud-Agent (R2). Du arbeitest die 8 Schritte der Methodik
**seriell** durch, fuer das Modul `ingestion`.

Output landet in:
- `docs/refactor/ingestion/00-audit.md`
- `docs/refactor/ingestion/02-contracts.md`
- `docs/refactor/ingestion/03-tests.md`
- `docs/refactor/ingestion/04-altlast-pass.md`
- `docs/refactor/ingestion/05-user-test-plan.md`
- `docs/refactor/ingestion/06-acceptance.md`

Code-Aenderungen landen direkt in `src/lib/ingestion/`, neue Tests in
`tests/unit/ingestion/` (Verzeichnis existiert noch nicht). Eine
modul-spezifische Contract-Rule `.cursor/rules/ingestion-contracts.mdc`
wird neu erstellt.

## Vorab-Entscheidungen (vom IDE-Agent vor Start geklaert)

### E1: Verhaeltnis zu `ingest-mongo-only.mdc`

Die bestehende [`ingest-mongo-only.mdc`](../../../.cursor/rules/ingest-mongo-only.mdc)
beschreibt das **Warum** auf Pipeline-Ebene (kein Fallback fuer Ingest).
Die neue `ingestion-contracts.mdc` beschreibt das **Wie genau** auf
Funktions-/Fehler-Ebene fuer die Module unter `src/lib/ingestion/`.

**Pruefe in Schritt 0**, ob die Glob-Liste in `ingest-mongo-only.mdc`
um `src/lib/ingestion/**/*.ts` erweitert werden sollte (sie ist
aktuell auf Wizard-/External-Jobs-Pfade beschraenkt).

### E2: `image-processor.ts` (781 Z.) Split-Strategie

**Pragmatisch wie in Welle 2**: erst Char-Tests fuer alle bestehenden
oeffentlichen Methoden, dann pure Helper extrahieren (Cache-Logik,
Hash-Berechnung, Pfad-Resolver), Klasse als Composer/Fassade belassen.
Voller Split nach Verarbeitungs-Typ (markdown/slides/cover) ist Folge-PR.

Mindest-Ziel: `image-processor.ts < 600 Zeilen` durch Helper-Extraction.
Stretch-Ziel: `< 400 Zeilen`. Beides ist OK — Modul-DoD nicht doppelt
ambitionieren wie in Welle 2.

### E3: Char-Test-Status

Modul hat **null Tests**. Welle 3 fokussiert auf:
- 1 Test-File pro Quell-File (mind. 6 neue Test-Files)
- Mind. 2-3 Tests pro File (Happy-Path + Fehler-Pfad)
- Insgesamt **15-25 neue Tests** (analog Welle 2 mit 21).

Mocks sind Pflicht:
- `vi.mock('@/lib/services/azure-storage-service')` fuer Azure-Calls
- `vi.mock('@/lib/repositories/shadow-twin-repo')` fuer Mongo-Calls
- `vi.mock('@/lib/external-jobs-log-buffer')` fuer Logger-Aufrufe

### E4: Modul-DoD vs. Welle 2

Wegen kompaktem Modul (7 Files) und null Bestands-Tests:

| Kriterium | Erwartung | Begruendung |
|---|---|---|
| `pnpm test` gruen | >= aktuell + 15-25 neue Tests | Char-Tests sind Hauptlast |
| `pnpm lint` ohne neue Errors | 0 | unveraendert |
| Files | 7 + 0-3 (Helper) | Helper aus image-processor |
| Max-Zeilen | 781 → **< 600** (mind.) | Helper-Extracts |
| > 200 Zeilen | 1 → **0-1** | falls image-processor unter 200 → 0 |
| Leere Catches | 0 | bleibt |
| `any` | 0 | bleibt |

**Stretch (nicht Pflicht)**: image-processor < 400 Z., > 200 Zeilen = 0.

## Schritt-fuer-Schritt-Ablauf

### Schritt 0 — Bestands-Audit

- File: `docs/refactor/ingestion/00-audit.md`
- 3 Tabellen (Rules, Tests, Docs) wie Welle-2-Vorlage.
- **Rules zu pruefen**: `ingest-mongo-only.mdc`, `contracts-story-pipeline.mdc`,
  `detail-view-type-checklist.mdc`, plus globale (`no-silent-fallbacks.mdc`,
  `storage-abstraction.mdc`).
- **Tests**: 0 in `tests/unit/ingestion/`. Pruefe ob Cross-Modul-Tests
  (z.B. in `tests/unit/external-jobs/phase-ingest*.test.ts`) Ingestion-Code
  testen — falls ja, dokumentieren als `keep`.
- **Docs**: alle `docs/**/*.md`, die `ingestion` erwaehnen. Mindestens
  pruefen: `docs/analysis/ingestion.md`, `docs/architecture/pipeline-phases.md`,
  `docs/architecture/artifact-pipeline-v3-design.md`,
  `docs/rules/ingest-mongo-only.md`,
  `docs/architecture/mongodb-vector-search.md`.

### Schritt 1 — Inventur

File: [`01-inventory.md`](./01-inventory.md) **existiert bereits** (IDE-Agent
Pre-Flight).

### Schritt 2 — Contracts

- Neue Rule: `.cursor/rules/ingestion-contracts.mdc`
- Globs: `["src/lib/ingestion/**/*.ts"]`
- `alwaysApply: true` (analog `shadow-twin-contracts.mdc`).
- Mindestens definieren:
  - **§1 Determinismus**: pure Helper sind seiteneffekt-frei
    (`page-split`, `metadata-formatter`, `ingest-meta-keys`).
    `image-processor` nicht — hat State (Cache).
  - **§2 Fehler-Semantik**: kein silent fallback; Azure-Upload-Fehler
    werden in Result-Objekten zurueckgegeben (Pattern in `ImageProcessingError`),
    kein `catch {}`.
  - **§3 Erlaubte/verbotene Abhaengigkeiten**: DARF abhaengen von
    `src/lib/storage`, `src/lib/services/azure-storage-service`,
    `src/lib/shadow-twin/mongo-shadow-twin-id`, `src/lib/repositories`.
    DARF NICHT abhaengen von `src/components/**`, `src/app/**` (UI).
  - **§4 Skip-/Default-Semantik**: was passiert bei fehlenden
    Bildern, leeren Texten, fehlenden Embeddings?
  - **§5 Cache-Vertrag**: `ImageProcessor.imageCache` ist klassen-statisch,
    `clearImageCache()` fuer Tests Pflicht.
  - **§6 Mongo-Only-Vertrag**: Verbindung zur bestehenden
    `ingest-mongo-only.mdc` herstellen — was darf NICHT aus Filesystem
    geladen werden.

### Schritt 3 — Characterization Tests

**Mindestens 6 neue Test-Files**, eines pro Quell-File:

| Test-File | Testet | Mindest-Tests |
|---|---|---|
| `tests/unit/ingestion/image-processor-markdown.test.ts` | `processMarkdownImages` | 3 (happy, no images, error) |
| `tests/unit/ingestion/image-processor-cache.test.ts` | Cache-Helper + `clearImageCache` | 2 |
| `tests/unit/ingestion/vector-builder.test.ts` | `vector-builder.ts` | 2-3 |
| `tests/unit/ingestion/document-text-builder.test.ts` | `document-text-builder.ts` | 2-3 |
| `tests/unit/ingestion/meta-document-builder.test.ts` | `meta-document-builder.ts` | 2-3 |
| `tests/unit/ingestion/metadata-formatter.test.ts` | `metadata-formatter.ts` | 2-3 (pure Funktion) |
| `tests/unit/ingestion/page-split.test.ts` | `page-split.ts` | 2-3 (pure Funktion) |

**Mocks**: alle Azure-/Mongo-Calls sauber gemockt. Keine Live-Calls.

### Schritt 4 — Altlast-Pass

**Pflicht-Subset** (konservativ, analog Welle 2):

1. **Pure Helper aus `image-processor.ts` extrahieren** in eine neue
   Datei `src/lib/ingestion/image-processor-helpers.ts` (oder mehrere):
   - Cache-Key-Berechnung
   - Hash-/Extension-Resolver
   - Markdown-Image-Regex-Extraktion
   - mind. 1-3 Helper, je nach was sich anbietet
2. **Falls vorhanden**: Silent-Catches dokumentieren oder beheben
   (laut Health 0; trotzdem Audit).
3. **UI/Service-Branches**: pruefen ob Komponenten direkt Ingestion
   importieren — sollte NICHT der Fall sein. Falls ja: Service-Layer.

**NICHT in dieser Welle**:
- Vollstaendiger Split von `image-processor.ts` nach Verarbeitungs-Typ
  (markdown/slides/cover) — Folge-PR.
- Klasse `ImageProcessor` in pure Funktionen aufloesen — Folge-PR.

### Schritt 5 — Strangler-Fig

Entfaellt fuer `ingestion` — keine Duplikate erkennbar, keine parallele
Implementierung. Nichts zu tun.

### Schritt 6 — Dead-Code

- `pnpm knip` laufen lassen
- Findings in `src/lib/ingestion/`-Modulgrenzen pruefen
- **Vor jeder Loeschung**: User-Frage analog Welle 2, weil kein
  Pre-Flight-Beleg fuer toten Code vorliegt.
- Audit-Findings mit Status `delete`/`archive` aus Schritt 0 hier umsetzen.

### Schritt 7 — Abnahme

Du fuellst BEIDE DoD-Teile (R5):

**Methodik-DoD**:
- Alle 6 Doku-Files vorhanden (`00-audit.md` bis `06-acceptance.md`).
- `ingestion-contracts.mdc` existiert.
- Char-Tests existieren (mind. 15 neue, idealerweise 20-25).

**Modul-DoD** (in DIESER Welle erreichbar):
- `pnpm test` gruen (mind. 511 + 15-25 neue Tests = ≥ 526)
- `pnpm lint` ohne neue Errors
- `pnpm health -- --module ingestion` zeigt:
  - Files: 7 + 0-3 (Helper) = 7-10
  - Max-Zeilen: < 600 (durch Helper-Extracts; Stretch < 400)
  - > 200 Zeilen: 0 (Stretch) oder 1 (Pflicht)
  - leere Catches: 0 (unveraendert)
  - `any`: 0 (unveraendert)

## Push-Strategie (R1, R4)

**Du PUSHST NICHT auf master.** Stattdessen:

- Branch: `refactor/ingestion-welle-3` (existiert bereits, Pre-Flight
  ist erster Commit).
- Commit pro Schritt (`ingestion(audit): ...`, `ingestion(contracts): ...`,
  `ingestion(tests): ...`, `ingestion(altlast): ...`, etc.).
- 1 PR am Ende — User reviewt, mergt selbst nach lokaler Verifikation
  (R3 — User-UI-Smoke gemaess `05-user-test-plan.md`).
- `[skip ci]` fuer Doku-only-Commits.
- Mindestens 6 Min Abstand zum Welle-2-Merge auf master (R4).

## Stop-Bedingungen

Stoppe und melde dem User, wenn:

- `> 1.000 Zeilen Diff` in einem Commit
- Tests werden rot und du findest die Ursache nicht in 30 Min
- Architektur-Frage auftritt, die nicht im Brief geklaert ist
- Live-Mongo/Azure-Calls werden noetig — diese sind verboten, mocke sauber
- knip findet > 5 unklare unused-Files — User-Frage statt eigenmaechtiges Loeschen
