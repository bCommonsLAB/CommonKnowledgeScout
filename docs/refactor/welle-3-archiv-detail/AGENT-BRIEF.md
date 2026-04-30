# Cloud-Agent-Brief: Welle 3-II — Archiv-Detail

Stand: 2026-04-29. Erstellt vom Cloud-Agent als Pre-Flight + Lauf in einem.

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md) — Workflow-Regeln R1-R5.
2. **Vorbild-Welle**: [`docs/refactor/welle-3-schale-loader/`](../welle-3-schale-loader/) — komplette Doku-Serie + Modul-Split-Pattern.
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) Sektion 5 (Welle 3-II).
4. **Architektur-Rules** (alle relevant):
   - [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — UI darf Storage-Backend nicht kennen
   - [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — keine leeren Catches
   - [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) — Frontmatter enthaelt nur Dateinamen
   - [`detail-view-type-checklist.mdc`](../../../.cursor/rules/detail-view-type-checklist.mdc) — DetailViewType-Architektur
   - [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc)
5. **Inventur**: [`01-inventory.md`](./01-inventory.md) — verifizierte Health-Zahlen + Hot-Spots.
6. **AGENTS.md** im Repo-Root.

## Welle-Struktur

Wegen 4x Volumen von Welle 3-I (20.508 vs 5.427 Zeilen) wird Welle 3-II in 5
**getrennten Cloud-Lauefen** abgearbeitet (nicht 1 Lauf!):

| Lauf | Branch | Inhalt | Status |
|---|---|---|---|
| **Vorbereitung** | `refactor/welle-3-archiv-detail` | Pre-Flight, Audit, Contracts, kleine Altlasten (alle 7 Catches + 1 Storage-Branch + Char-Tests fuer kleine Files) | DIESE PR |
| **3-II-a** Preview-Switch | `refactor/welle-3-ii-a-preview-switch` | `file-preview.tsx` (3.701z) Modul-Split nach View-Typ | Cloud-Lauf NACH Vorbereitung-Merge |
| **3-II-b** Markdown | `refactor/welle-3-ii-b-markdown` | `markdown-preview.tsx` (2.054z) + `markdown-metadata.tsx` (437z) Splits | Cloud-Lauf NACH Vorbereitung-Merge (parallel zu 3-II-a moeglich, aber R2 sagt seriell) |
| **3-II-c** Detail-Tabs | `refactor/welle-3-ii-c-detail-tabs` | `job-report-tab.tsx` (2.284z) + `media-tab.tsx` (1.147z) Splits | Cloud-Lauf nach 3-II-b |
| **3-II-d** Detail+Flow | `refactor/welle-3-ii-d-detail-flow` | `*-detail.tsx`-Familie + `flow/*` + `shared/*` (`session-detail.tsx` 1.042z, `pipeline-sheet.tsx` 671z) | Cloud-Lauf nach 3-II-c |

R2 (1 Cloud-Agent seriell) gilt: **erst Vorbereitung mergen, dann 3-II-a, dann
3-II-b, ...**.

## Aufgabe DIESES Cloud-Laufs (Vorbereitung)

Schritte 0, 2, 3 (Char-Tests fuer kleinere Files), 4a, 5, 6, 7 nach Methodik.
Keine Modul-Splits fuer die 4 grossen Files (kommen in 3-II-a/b/c/d).

### Schritt 0 — Bestands-Audit

- File: `docs/refactor/welle-3-archiv-detail/00-audit.md`
- 3 Tabellen (Rules, Tests, Docs) wie in [Vorbild](../welle-3-schale-loader/00-audit.md).

### Schritt 1 — Inventur

- File: `01-inventory.md` ist schon vom Pre-Flight da (verifizierte Stats).

### Schritt 2 — Contracts

- Neue Rule: `.cursor/rules/welle-3-archiv-detail-contracts.mdc`
- Globs: `["src/components/library/file-preview.tsx", "src/components/library/file-preview/**", "src/components/library/markdown-preview.tsx", "src/components/library/markdown-preview/**", "src/components/library/job-report-tab.tsx", "src/components/library/job-report-tab/**", "src/components/library/media-tab.tsx", "src/components/library/media-tab/**", "src/components/library/*-detail.tsx", "src/components/library/audio-*.tsx", "src/components/library/video-*.tsx", "src/components/library/image-*.tsx", "src/components/library/pdf-*.tsx", "src/components/library/text-editor.tsx", "src/components/library/markdown-*.tsx", "src/components/library/chapter-accordion.tsx", "src/components/library/slide-accordion.tsx", "src/components/library/event-details-accordion.tsx", "src/components/library/transform-*.tsx", "src/components/library/document-preview.tsx", "src/components/library/cover-image-generator-dialog.tsx", "src/components/library/ingestion-status.tsx", "src/components/library/phase-stepper.tsx", "src/components/library/detail-view-renderer.tsx", "src/components/library/flow/**", "src/components/library/shared/**"]`
- Mindestens definieren:
  - **§1 Determinismus**: Detail-View-Komponenten sind UI-Renderer. Keine Frontmatter-Schreib-Logik.
  - **§2 Fehler-Semantik**: Keine leeren Catches; Fehler im Render-Pfad via Toast oder Error-Boundary.
  - **§3 Erlaubte/verbotene Abhaengigkeiten**: Detail-Komponenten duerfen NICHT direkt Storage-Provider importieren — nur via `useStorage()` oder zentrale Helper.
  - **§4 Skip-/Default-Semantik**: Was zeigen Detail-Komponenten, wenn Frontmatter-Felder fehlen? Antwort: Validation-Warning (siehe `detail-view-type-checklist.mdc`).
  - **§5 DetailViewType-Erweiterung**: Verweis auf `detail-view-type-checklist.mdc`.
  - **§6 Modul-Split-Vertrag** (fuer file-preview/markdown-preview/job-report-tab/media-tab — vorbereitend fuer Sub-Wellen).
  - **§7 Storage-Branches verboten**: Verweis auf `storage-abstraction.mdc`. Diagnose-Panels (z.B. `freshness-comparison-panel.tsx`) muessen Storage-Daten via API-Response erhalten, nicht via UI-Branch.

### Schritt 3 — Characterization Tests

Pflicht in DIESER PR (kleinere Files, die Sicherheitsnetz fuer Sub-Wellen werden):

1. `tests/unit/components/library/testimonial-detail.test.tsx`
2. `tests/unit/components/library/image-preview.test.tsx`
3. `tests/unit/components/library/text-editor.test.tsx`
4. `tests/unit/components/library/transform-result-handler.test.tsx`
5. `tests/unit/components/library/story-status.test.ts` (Pure Helper aus `shared/story-status.ts`)
6. `tests/unit/components/library/use-story-status.test.tsx` (Hook aus `shared/use-story-status.ts`)
7. `tests/unit/components/library/detail-view-renderer.test.tsx` (zentraler Renderer)
8. `tests/unit/components/library/markdown-metadata.test.tsx` (kein Hook, einfache Renderer)

**Char-Tests fuer file-preview/markdown-preview/job-report-tab/media-tab** kommen
in den jeweiligen Sub-Wellen 3-II-a/b/c — sonst sprengt der Diff.

### Schritt 4a — Kleine Altlasten

1. **Alle 7 leeren Catches eliminieren** (verifiziert via Inventur):
   - `src/components/library/file-preview.tsx:3652` (1)
   - `src/components/library/markdown-preview.tsx:859, 863, 931` (3)
   - `src/components/library/audio-transform.tsx:136` (1)
   - `src/components/library/video-transform.tsx:136` (1)
   - `src/components/library/pdf-transform.tsx:164` (1)
2. **1 Storage-Branch eliminieren** in
   `src/components/library/shared/freshness-comparison-panel.tsx:145`:
   - Aktuell: `data.config.primaryStore === "filesystem" || data.config.persistToFilesystem`
   - Soll: API-Response liefert ein `hasStorageColumn`-Flag, oder Helper aus
     `src/lib/storage/library-capability.ts` (siehe Welle 1) wird genutzt.
3. **Bestaetige**: `'use client'`-Direktiven werden NICHT geaendert (Pre-Existing-
   Pattern, riskant fuer Build).

### Schritt 4b — Sub-Wellen-Vorbereitung

Nicht in DIESER PR. Hier nur Backlog-Tabelle in `04-altlast-pass.md`.

### Schritt 5 — Strangler-Fig

Entfaellt in Vorbereitung.

### Schritt 6 — Dead-Code

- `pnpm knip` laufen lassen (Filter auf Welle-3-II-Files)
- Doku-Hygiene: `docs/reference/file-index.md` und
  `docs/reference/modules/library.md` ergaenzen falls noetig

### Schritt 7 — Abnahme

- Methodik-DoD + Modul-DoD wie Welle 3-I.
- **Modul-DoD fuer DIESE PR**: 0 leere Catches in Welle 3-II, 0 Storage-Branches,
  >= 8 neue Char-Test-Files, 40+ neue Test-Cases.
- Sub-Wellen-Plan in `06-acceptance.md` als Roadmap dokumentiert.

## Sub-Wellen-Briefs (fuer Folge-Cloud-Lauefe)

**Strategie ab 2026-04-30**: Pro Sub-Welle EINE PR mit mehreren
kohaerenten Commits — siehe [`refactor-batch-strategy.mdc`](mdc:.cursor/rules/refactor-batch-strategy.mdc).

Diese Briefs werden im Folge-Cloud-Lauf separat gestartet, sobald die
jeweils vorherige Sub-Welle gemerged ist (R2: seriell).

### Cloud-Auftrag fuer 3-II-a (Preview-Switch) — ABGESCHLOSSEN

Welle 3-II-a wurde in 5 PRs (#28, #29, #32, #33, #34) abgewickelt — das
war noch die alte Strategie. Bilanz: file-preview.tsx von 4.230 auf
1.288 Zeilen reduziert (-69.5%), 9 View-Komponenten ausgegliedert.

Ab Welle 3-II-b gilt die neue Strategie (1 PR pro Sub-Welle).

### Cloud-Auftrag fuer 3-II-b (Markdown) — 1 PR

```
Lies VOR dem Start:
- docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-b")
- .cursor/rules/welle-3-archiv-detail-contracts.mdc
- .cursor/rules/refactor-batch-strategy.mdc (NEU — 1 PR pro Welle)
- AGENTS.md (Branching/Stop-Bedingungen)

Aufgabe: markdown-preview.tsx (2.054 Zeilen, 41 Hooks) + markdown-metadata.tsx
(437z) Modul-Splits.

Branch: cursor/refactor-welle-3-ii-b-markdown-<suffix>

Strategie: 1 PR mit ~6-9 kohaerenten Commits, jeder unter 1.000 Zeilen Diff.

Hinweis: 3-II-Vorbereitung hat die 3 leeren Catches in markdown-preview.tsx
schon eliminiert. Hier geht es nur um den Modul-Split.

Zielstruktur:
  src/components/library/markdown-preview/
    index.tsx                    # Composer (Hauptdatei nach Refactor)
    toc-builder.tsx              # Table-of-Contents
    search-overlay.tsx           # Suche im Markdown
    chapter-renderer.tsx         # ChapterAccordion-Integration
    slide-renderer.tsx           # SlideAccordion-Integration
    hooks/
      use-markdown-search.ts
      use-markdown-toc.ts

  src/components/library/markdown-metadata/
    index.tsx                    # Composer
    field-renderer.tsx
    edit-mode.tsx

Empfohlene Commit-Reihenfolge (anpassen nach Audit):
  1. Char-Tests fuer markdown-preview.tsx (Sicherheitsnetz)
  2. Helper extrahieren (toc-builder, search-overlay)
  3. ChapterRenderer + SlideRenderer ausgliedern
  4. Hooks ausgliedern (use-markdown-search, use-markdown-toc)
  5. Composer-Integration in markdown-preview.tsx
  6. markdown-metadata.tsx Split (field-renderer, edit-mode)
  7. Cleanup ungenutzte Imports (NACH pnpm build, PFLICHT im selben PR)
  8. Acceptance-Doc 06-acceptance-3-ii-b.md

Vor jedem Push: pnpm test + pnpm lint + pnpm build (PFLICHT!).

Stop wenn:
- 1 Commit > 1.000 Zeilen Diff (splitten)
- PR > 5.000 Zeilen Brutto-Diff (ohne Plan-Begruendung)
- PR > 15 Commits

PR als Draft. Smoke-Test-Plan im PR-Body (max 10 Klicks).
Antworte auf Deutsch.
```

### Cloud-Auftrag fuer 3-II-c (Detail-Tabs) — 1 PR

```
Lies VOR dem Start:
- docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-c")
- .cursor/rules/welle-3-archiv-detail-contracts.mdc
- .cursor/rules/detail-view-type-checklist.mdc
- .cursor/rules/refactor-batch-strategy.mdc
- AGENTS.md

Aufgabe: job-report-tab.tsx (2.284z, 30 Hooks) + media-tab.tsx (1.147z, 13 Hooks)
Modul-Splits.

Branch: cursor/refactor-welle-3-ii-c-detail-tabs-<suffix>

Strategie: 1 PR mit ~7-10 kohaerenten Commits.

Zielstruktur:
  src/components/library/job-report-tab/
    index.tsx                    # Composer
    teaser-card.tsx              # Pflichtfeld-Validierung + Vorschau-Karte
    field-mapper.tsx             # Felder-Mapping pro DetailViewType
    job-status-bar.tsx
    hooks/
      use-job-report.ts

  src/components/library/media-tab/
    index.tsx                    # Composer
    media-grid.tsx               # Bilder-Galerie der Quelldatei
    media-row.tsx                # Einzeltrigger
    upload-area.tsx              # Re-Upload + Cover-Auswahl
    hooks/
      use-media-data.ts

Detail-View-Type-Erweiterungs-Vertrag bleibt stabil:
job-report-tab/index.tsx exportiert weiter dieselbe Komponente unter
demselben Pfad, sonst bricht .cursor/rules/detail-view-type-checklist.mdc
Punkt 9.

Empfohlene Commit-Reihenfolge:
  1. Char-Tests fuer job-report-tab + media-tab
  2. job-report-tab: teaser-card extrahieren
  3. job-report-tab: field-mapper extrahieren
  4. job-report-tab: job-status-bar extrahieren
  5. job-report-tab: use-job-report Hook extrahieren
  6. job-report-tab: Composer-Integration
  7. media-tab: media-grid + media-row + upload-area extrahieren
  8. media-tab: use-media-data Hook extrahieren
  9. media-tab: Composer-Integration
  10. Cleanup + Acceptance-Doc

Vor jedem Push: pnpm test + pnpm lint + pnpm build (PFLICHT).

Stop-Bedingungen siehe refactor-batch-strategy.mdc.

PR als Draft. Smoke-Test-Plan im PR-Body.
Antworte auf Deutsch.
```

### Cloud-Auftrag fuer 3-II-d (Detail + Flow) — 1 PR

```
Lies VOR dem Start:
- docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-d")
- .cursor/rules/welle-3-archiv-detail-contracts.mdc
- .cursor/rules/detail-view-type-checklist.mdc
- .cursor/rules/refactor-batch-strategy.mdc
- AGENTS.md

Aufgabe: session-detail.tsx (1.042z, 19 Hooks) + flow/pipeline-sheet.tsx (671z) +
cover-image-generator-dialog.tsx (458z) + shared/artifact-info-panel.tsx (333z) +
shared/artifact-markdown-panel.tsx (325z) + shared/shadow-twin-artifacts-table.tsx
(393z) Modul-Splits.

Gesamt-Volumen: ~3.200 Zeilen ueber 6 Files. Ist die groesste verbleibende
Sub-Welle. Wenn das Brutto-Diff der PR > 5.000 Zeilen wird (mit Char-Tests
+ Acceptance), darf die Welle in 2 PRs aufgeteilt werden:
- 3-II-d-1: session-detail + cover-image-generator-dialog (eigenstaendige
  Komponenten)
- 3-II-d-2: flow/pipeline-sheet + shared/* (gemeinsame Bibliotheks-Files)

Branch: cursor/refactor-welle-3-ii-d-detail-flow-<suffix>

Strategie: 1 PR (oder 2 wenn > 5.000 Zeilen) mit kohaerenten Commits.

Pro Datei eigene Sub-Module. Char-Tests vorher schreiben.

Vor jedem Push: pnpm test + pnpm lint + pnpm build (PFLICHT).

Stop-Bedingungen siehe refactor-batch-strategy.mdc.

PR als Draft. Smoke-Test-Plan im PR-Body.
Antworte auf Deutsch.
```

## Push-Strategie

**Du PUSHST NICHT auf master.** Stattdessen:

- Eigener Branch pro Sub-Welle: `cursor/refactor-welle-3-ii-<sub>-<suffix>`
- Mehrere kohaerente Commits, jeder unter 1.000 Zeilen Diff
- **Eine PR pro Sub-Welle** (siehe `.cursor/rules/refactor-batch-strategy.mdc`)
- Kein Auto-Merge — User reviewt, smoke-testet, merged dann selbst.

## Stop-Bedingungen

Stoppe und melde dem User, wenn:
- `> 1.000 Zeilen Diff` in einem **einzelnen** Commit (hart — splitte)
- `> 5.000 Zeilen Brutto-Diff` in einer **PR** ohne Plan-Begruendung
- `> 15 Commits` in einer PR
- Tests werden rot und du findest die Ursache nicht in 30 Min
- `pnpm build` rot und nach 3 Versuchen keine Loesung
- React-Error-Boundary-Fehler im UI nach Refactor — erst mit User klaeren
- Architektur-Frage auftritt, die nicht im Brief geklaert ist
- Storage-Provider-Live-Calls werden noetig — verboten, sauber mocken
- DetailViewType-Vertrag wird gebrochen (siehe `detail-view-type-checklist.mdc`)
- Cleanup-Commit kann ungenutzte Imports nicht alle entfernen, weil ein
  Import noch in einem nicht refactorierten Switch-Case verwendet wird

## Daten zum Mitnehmen

- Repo: `bCommonsLAB/CommonKnowledgeScout`, default branch `master`
- Aktueller Stand `master`: Wellen 0-2 + 3-I abgenommen
- Test-Setup: `pnpm install` (Node 20+, pnpm 9.15.3)
- Tools (Reihenfolge verbindlich vor jedem Push):
  1. `pnpm test` — Vitest
  2. `pnpm lint` — ESLint via `next lint`
  3. **`pnpm build`** — `next build`, **PFLICHT** (siehe Lehre unten)
  4. `node scripts/ui-welle-3ii-stats.mjs` — Welle-3-II-Stats
  5. `pnpm knip` — Dead-Code
- **Keine** Live-Storage-Provider-Calls, keine Live-Mongo-Calls (siehe AGENTS.md)

## Lehre aus PR #29 / Hotfix #30 (2026-04-30)

Beim Modul-Split von `file-preview.tsx` blieben 5 ungenutzte Imports
zurueck (`ArrowLeft`, `Eye`, `Loader2`, `Scissors`, `ImagePreviewComponent`).
`pnpm test` und `pnpm lint` waren lokal **gruen**, doch `pnpm build` (CI)
brach mit `@typescript-eslint/no-unused-vars` als hard error. Production-
Deploy war rot bis zum Hotfix #30.

**Konsequenz fuer Sub-Wellen 3-II-a Phase 2b/2c/2d und 3-II-b/c/d**:

- **Vor jedem `git push` muss `pnpm build` lokal gruen sein.**
- Nach jedem Modul-Split: **explizit pruefen**, welche Imports im
  Mutterfile nach Extraktion noch genutzt werden. Tipp:
  ```
  rg "ArrowLeft|Eye|Loader2|Scissors" src/components/library/file-preview.tsx
  ```
- **NICHT** auf `pnpm lint` allein verlassen — `next lint` klassifiziert
  `no-unused-vars` als Warning, `next build` als Error.

Diese Regel ist auch in `AGENTS.md` (Sektion "Test- und Lint-Commands")
festgehalten.
