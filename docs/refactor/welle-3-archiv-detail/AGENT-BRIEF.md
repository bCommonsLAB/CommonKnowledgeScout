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

Diese Briefs werden im Folge-Cloud-Lauf separat gestartet, sobald die
Vorbereitungs-PR gemerged ist.

### Cloud-Auftrag fuer 3-II-a (Preview-Switch)

```
Lies docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-a"),
.cursor/rules/welle-3-archiv-detail-contracts.mdc und
.cursor/rules/detail-view-type-checklist.mdc.

Aufgabe: file-preview.tsx (3.701 Zeilen, 66 Hooks) Modul-Split nach View-Typ.

Branch: refactor/welle-3-ii-a-preview-switch (von master nach 3-II-Vorbereitung-Merge).

Zielstruktur (Cloud-Agent verfeinert nach Audit):
  src/components/library/file-preview/
    index.tsx                     # Composer, exportiert FilePreview (~250z)
    extension-map.ts              # MIME/Endung -> View-Typ
    preview-reducer.ts            # Tab-State (transcript|transformation|story|media|file)
    views/
      audio-view.tsx
      image-view.tsx
      video-view.tsx
      markdown-view.tsx
      pdf-view.tsx
      office-view.tsx
      presentation-view.tsx
      website-view.tsx
    hooks/
      use-preview-data.ts        # Daten-Hook
      use-preview-tabs.ts         # Tab-Switch + URL-Sync

Vor jedem Sub-Split: Char-Tests aus tests/unit/components/library/file-preview/
gruen halten. Pro View-Typ ein eigener Commit, max 500 Zeilen Diff pro Commit.

Stop wenn > 1.000 Zeilen Diff in einem Commit.
Antworte auf Deutsch. PR als Draft.
```

### Cloud-Auftrag fuer 3-II-b (Markdown)

```
Lies docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-b"),
.cursor/rules/welle-3-archiv-detail-contracts.mdc.

Aufgabe: markdown-preview.tsx (2.054 Zeilen, 41 Hooks) + markdown-metadata.tsx
(437z) Modul-Splits.

Branch: refactor/welle-3-ii-b-markdown (von master nach 3-II-a-Merge).

Hinweis: 3-II-Vorbereitung hat die 3 leeren Catches in markdown-preview.tsx
schon eliminiert. Hier geht es nur um den Modul-Split.

Zielstruktur:
  src/components/library/markdown-preview/
    index.tsx                    # Composer
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

Pro Sub-File ein eigener Commit. Char-Tests vorher schreiben.
Stop wenn > 1.000 Zeilen Diff in einem Commit.
Antworte auf Deutsch. PR als Draft.
```

### Cloud-Auftrag fuer 3-II-c (Detail-Tabs)

```
Lies docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-c"),
.cursor/rules/welle-3-archiv-detail-contracts.mdc und
.cursor/rules/detail-view-type-checklist.mdc.

Aufgabe: job-report-tab.tsx (2.284z, 30 Hooks) + media-tab.tsx (1.147z, 13 Hooks)
Modul-Splits.

Branch: refactor/welle-3-ii-c-detail-tabs (von master nach 3-II-b-Merge).

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

Pro Sub-File ein eigener Commit. Char-Tests vorher schreiben.
Stop wenn > 1.000 Zeilen Diff in einem Commit.
Antworte auf Deutsch. PR als Draft.
```

### Cloud-Auftrag fuer 3-II-d (Detail + Flow)

```
Lies docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md (Sektion "3-II-d"),
.cursor/rules/welle-3-archiv-detail-contracts.mdc und
.cursor/rules/detail-view-type-checklist.mdc.

Aufgabe: session-detail.tsx (1.042z, 19 Hooks) + flow/pipeline-sheet.tsx (671z) +
cover-image-generator-dialog.tsx (458z) + shared/artifact-info-panel.tsx (333z) +
shared/artifact-markdown-panel.tsx (325z) + shared/shadow-twin-artifacts-table.tsx
(393z) Modul-Splits.

Branch: refactor/welle-3-ii-d-detail-flow (von master nach 3-II-c-Merge).

Pro Datei eigene Sub-Module. Char-Tests vorher schreiben.
Stop wenn > 1.000 Zeilen Diff in einem Commit.
Antworte auf Deutsch. PR als Draft.
```

## Push-Strategie (R1, R4)

**Du PUSHST NICHT auf master.** Stattdessen:

- Eigener Branch: `refactor/welle-3-archiv-detail`
- Commit pro Schritt
- 1 PR am Ende, alle Schritte enthaltend
- Kein Auto-Merge — User reviewt, smoke-testet, merged dann selbst.

## Stop-Bedingungen

Stoppe und melde dem User, wenn:
- `> 1.000 Zeilen Diff` in einem Commit (zu riskant, splitte)
- Tests werden rot und du findest die Ursache nicht in 30 Min
- React-Error-Boundary-Fehler im UI nach Refactor — erst mit User klaeren, nicht raten
- Architektur-Frage auftritt, die nicht im Brief geklaert ist
- Storage-Provider-Live-Calls werden noetig — verboten, sauber mocken
- DetailViewType-Vertrag wird gebrochen (siehe `detail-view-type-checklist.mdc`)

## Daten zum Mitnehmen

- Repo: `bCommonsLAB/CommonKnowledgeScout`, default branch `master`
- Aktueller Stand `master`: Wellen 0-2 + 3-I abgenommen
- Test-Setup: `pnpm install` (Node 20+, pnpm 9.15.3)
- Tools:
  - `pnpm test` — Vitest
  - `pnpm lint` — ESLint
  - `node scripts/ui-welle-3ii-stats.mjs` — Welle-3-II-Stats
  - `pnpm knip` — Dead-Code
- **Keine** Live-Storage-Provider-Calls, keine Live-Mongo-Calls (siehe AGENTS.md)
