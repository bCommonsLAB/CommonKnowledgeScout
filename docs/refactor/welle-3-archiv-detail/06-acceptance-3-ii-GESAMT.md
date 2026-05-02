# Welle 3-II — Gesamt-Acceptance (alle 4 Sub-Wellen abgeschlossen)

**Stand**: 2026-05-01
**Status**: ABGESCHLOSSEN
**Methodik**: 8-Step-Refactoring nach `docs/refactor/playbook.md`,
seit Welle 3-II-b umgestellt auf 1-PR-pro-Welle (PR #35)

## Bilanz auf einen Blick

Welle 3-II umfasste den gesamten **Archiv-Detail-Bereich** der Library
(file-preview, markdown-preview, job-report-tab, media-tab, detail-tabs,
flow + shared). Ueber 5 Sub-Wellen wurden **6 Hauptdateien** modularisiert.

| Hauptdatei | Welle-Start | Welle-Ende | Reduktion |
|---|---:|---:|---:|
| `file-preview.tsx` | 4.230 | 1.288 | **-2.942 (-69.5%)** |
| `markdown-preview.tsx` | 2.064 | 798 | **-1.266 (-61.3%)** |
| `markdown-metadata.tsx` | 437 | 287 | **-150 (-34.3%)** |
| `job-report-tab.tsx` | 2.296 | 2.262 | -34 (-1.5%) |
| `media-tab.tsx` | 1.187 | 958 | -229 (-19.3%) |
| `flow/pipeline-sheet.tsx` | 670 | 621 | -49 (-7.3%) |
| `shared/artifact-info-panel.tsx` | 332 | 308 | -24 (-7.2%) |
| `shared/artifact-markdown-panel.tsx` | 324 | 319 | -5 (-1.5%) |
| `shared/shadow-twin-artifacts-table.tsx` | 392 | 358 | -34 (-8.7%) |
| **Total Hauptdateien** | **11.932** | **7.199** | **-4.733 (-39.7%)** |

**20 neue Sub-Module + 82 neue Char-Test-Cases** ueber alle Sub-Wellen.

## Sub-Wellen im Detail

### Welle 3-II-Vorbereitung (PR #27)

**Branch**: `refactor/welle-3-archiv-detail`
**Inhalt**: Audit + Inventur + Contracts + 7 Char-Test-Files + 7 Catches
+ 1 Storage-Branch eliminiert
**Acceptance**: `06-acceptance.md`

### Welle 3-II-a — file-preview.tsx Modul-Split (PRs #28-#34)

**Branches**:
- `refactor/welle-3-ii-a-preview-switch` (PR #28)
- `refactor/welle-3-ii-a-2-preview-views` (PR #29)
- `refactor/welle-3-ii-a-2-preview-views-2b/2c/2d` (PRs #32, #33, #34)
- `cursor/hotfix-file-preview-unused-imports-a03a` (Hotfix #30)

**Inhalt**: `file-preview.tsx` aufgeteilt in 9 View-Komponenten + 5 Helper-
Module. PreviewContent-Switch reduziert auf reinen View-Composer.

**Acceptances**: `06-acceptance-3-ii-a.md`, `06-acceptance-3-ii-a-2.md`,
`06-acceptance-3-ii-a-2b.md`, `06-acceptance-3-ii-a-2c.md`,
`06-acceptance-3-ii-a-2d.md`

**Bilanz**: 4.230 → 1.288 Zeilen (-69.5%)

### Welle 3-II-b — markdown-preview + markdown-metadata (PR #36)

**Branch**: `cursor/refactor-welle-3-ii-b-markdown-a03a`

**Inhalt**: Erste Welle unter neuer **1-PR-pro-Welle-Strategie** (PR #35).
markdown-preview.tsx + markdown-metadata.tsx in 5 Sub-Module aufgeteilt
(`markdown-helpers.ts`, `md-renderer.ts`, `search-popover.tsx`,
`text-transform.tsx` + `cell-utils.ts`).

**Acceptance**: `06-acceptance-3-ii-b.md`

**Bilanz**: 2.501 → 1.085 Zeilen (-56.6%)

### Welle 3-II-c — job-report-tab + media-tab Helper-Extract (PR #37)

**Branch**: `cursor/refactor-welle-3-ii-c-detail-tabs-a03a`

**Inhalt**: Konservativer Helper-Extract. Plan-Anpassung: AGENT-BRIEF
schlug Sub-Komponenten vor — die Files sind aber monolithische
Render-Funktionen ohne klare Sub-Komponenten-Struktur. Stattdessen
6 Helpers + 2 Types + 1 Pure-Helper aus media-tab + 1 Pure-Helper +
1 Type aus job-report-tab ausgegliedert.

**Acceptance**: `06-acceptance-3-ii-c.md`

**Bilanz**: 3.483 → 3.220 Zeilen (-7.5%) — wenig, aber konservativ
korrekt. Future Work: Hook-Extraktion (Welle 3-II-Hooks, abgeschlossen).

### Welle 3-II-d — Detail + Flow + Shared (PR #38)

**Branch**: `cursor/refactor-welle-3-ii-d-detail-flow-a03a`

**Inhalt**: 4 von 6 Files Helpers ausgegliedert (artifact-info-panel,
artifact-markdown-panel, shadow-twin-artifacts-table, pipeline-sheet).
session-detail.tsx und cover-image-generator-dialog.tsx haben keine
Top-Level-Helpers — Future Work.

**Acceptance**: `06-acceptance-3-ii-d.md`

**Bilanz**: 1.718 → 1.606 Zeilen (-6.5%)

## Methodik-Lehren aus Welle 3-II

### Lehre 1: `pnpm build`-Pflicht (PR #31)

Nach PR #29 / Hotfix #30 wurde klar: **`pnpm lint` allein reicht nicht**.
Lokal sind ungenutzte Imports nur Warnings — `next build` macht daraus
hard errors. Seit PR #31 ist `pnpm build` Pflicht vor jedem Push.

**Effekt**: Hat in 5 Sub-Wellen wiederholt Bugs vor dem Push abgefangen
(28+ ungenutzte Imports, Hook-Order-Bugs, fehlende Type-Imports).
**Kein einziger Hotfix-PR seit PR #31.**

### Lehre 2: 1 PR pro Welle (PR #35)

Initial wurde Welle 3-II-a in 5 separaten PRs abgewickelt — viel
CI-Overhead. Seit Welle 3-II-b: **1 PR pro Sub-Welle** mit mehreren
kohaerenten Commits, Diff-Limits in `refactor-batch-strategy.mdc`:
- max 1.000 Zeilen pro Commit (hart)
- max 5.000 Zeilen Brutto-Diff pro PR (weich)
- max 15 Commits pro PR (weich)

**Effekt**: 4 PRs statt ~8-11 PRs fuer Welle 3-II-b/c/d.
CI-Wartezeit halbiert.

### Lehre 3: AGENT-BRIEF != Realitaet

In jeder der 4 Sub-Wellen musste der vorgeschlagene Plan an die
**echte Code-Struktur** angepasst werden. Die Sub-Komponenten
(`teaser-card`, `field-mapper`, `media-grid` etc.) existieren oft
nur als Konzept — der Code ist tatsaechlich monolithischer.

**Effekt**: Plan-Anpassungen wurden in jeder Acceptance-Doku
explizit dokumentiert — wertvoller Kontext fuer kommende Wellen.

### Lehre 4: Konservativer Helper-Extract als Default

Bei monolithischen Render-Funktionen mit tiefen Closures ist
Hook-/Sub-Komponenten-Extraktion **riskant ohne Architektur-
Entscheidung**. Default-Strategie:
- Pure-Helpers raus
- Async-Helpers (mit klarer Signatur) raus
- Types raus
- Render-Logik unangetastet

Grosse Splits sind dann **Future Work** (Welle 3-II-Hooks, abgeschlossen).

### Lehre 5: Re-Export-Pattern haelt API stabil

Bei `pipeline-sheet.tsx` (Welle 3-II-d) wurden Helpers + Types in ein
Sub-Modul verschoben, aber das Mutterfile macht einen `export {...}
from './helpers'`-Re-Export. Konsumenten (8 View-Komponenten) muessen
ihre Imports nicht aendern. **Pattern fuer alle kommenden Wellen.**

## Methodik-DoD Welle 3-II Gesamt

| Kriterium | Status | Belege |
|---|---|---|
| 8-Step-Methodik durchgefuehrt | OK | Audit + Inventur + Contracts + Char-Tests + Altlast-Pass + Strangler-Fig + Dead-Code + Abnahme |
| Alle 5 Sub-Wellen mit eigener Acceptance-Doku | OK | 06-acceptance.md, 06-acceptance-3-ii-{a, a-2, a-2b, a-2c, a-2d, b, c, d}.md |
| Modul-spezifische Contract-Rule | OK | `.cursor/rules/welle-3-archiv-detail-contracts.mdc` |
| Char-Tests vor Code-Aenderungen | OK | 82 Cases ueber alle Sub-Wellen |
| Pro Schritt eigener Commit | OK | siehe einzelne Acceptance-Docs |
| `pnpm test` gruen am Ende | OK | 1.124 Tests / 175 Files |
| `pnpm lint` gruen am Ende | OK | nur vor-existierende Warnings |
| `pnpm build` gruen am Ende | OK | exit 0 |
| Cleanup im selben PR | OK | seit 3-II-b konsequent |

## Modul-DoD Welle 3-II Gesamt

| Kriterium | Status |
|---|---|
| `file-preview.tsx` ist reiner View-Composer (Switch-Cases nur noch Routing) | OK |
| `markdown-preview.tsx` ist reduziert auf Composer + DOM-Logik | OK |
| `markdown-metadata.tsx` ist reduziert auf Composer + extractFrontmatter | OK |
| Pure-Funktionen + Types in eigenen Modulen | OK (20 Sub-Module) |
| Renderer-Setup in eigenem Modul | OK (`md-renderer.ts`) |
| Sub-Komponenten in eigenen Modulen | OK (9 View-Komponenten + 4 weitere Sub-Komponenten) |
| Re-Export-Pattern bei Public-API-Komponenten (pipeline-sheet) | OK |

## Future Work (umgesetzt in Welle 3-II-Hooks)

> **Naming-Update 2026-05-01**: Diese Future-Work-Welle hieß initial
> "Welle 3-III" und wurde zu **Welle 3-II-Hooks** umbenannt, weil der
> Name "3-III" laut Plan-File für die noch nicht begonnene Welle
> "Galerie + Story-Mode + Chat" reserviert ist.
>
> Acceptance-Doku: `../welle-3-ii-hooks/06-acceptance-3-ii-hooks-GESAMT.md`

Folgende Files sind zwar in Welle 3-II beruehrt worden, aber haben
**weiteres Refactor-Potenzial**, das spezielle Architektur-Entscheidungen
braucht:

### job-report-tab.tsx (2.262z restlich)
- State + Effects als Custom-Hook (`use-job-report-data`)
- 6 Tab-Bodies als Sub-Komponenten (markdown/meta/chapters/media/
  ingestion/process)
- Inline-Editing als `use-frontmatter-editor` Hook

### media-tab.tsx (958z restlich)
- `use-gallery-items` Hook (Siblings + binaryFragments)
- `use-assignment-target` Hook
- Upload-Area + Slot-Renderer als Sub-Komponenten

### session-detail.tsx (1.041z, unangetastet)
- `use-session-data` Hook
- Tab-Bodies als Sub-Komponenten

### cover-image-generator-dialog.tsx (457z, unangetastet)
- `use-image-generation` Hook
- Generated-Image-Grid als Sub-Komponente

**Welle 3-II-Hooks** (umgesetzt 2026-05-01): Diese 4 Files wurden in
Sub-Wellen 3-II-Hooks-a/b/c/d mit fokussierter **Hook-Extraktion**
abgearbeitet. PRs #40-#43 alle gemerged. Bilanz: -513z (-10.9%) ueber
4 Files, 4 neue Hook-Module, 35 neue Char-Tests. Vollstaendige
Dokumentation: `../welle-3-ii-hooks/06-acceptance-3-ii-hooks-GESAMT.md`.

## User-Sign-off

| Sub-Welle | PR | Smoke-Test bestanden | Merged |
|---|---|---|---|
| Vorbereitung | #27 | OK | OK |
| 3-II-a Phase 1 | #28 | OK | OK |
| 3-II-a Phase 2a | #29 | OK | OK (+ Hotfix #30) |
| 3-II-a Phase 2b | #32 | OK | OK |
| 3-II-a Phase 2c | #33 | OK | OK |
| 3-II-a Phase 2d | #34 | OK | OK |
| 3-II-b | #36 | OK | OK |
| 3-II-c | #37 | OK | OK |
| 3-II-d | #38 | OK | OK |

**Welle 3-II ist abgeschlossen und in Production.**

## Verweise

- Welle 3-I (App-Schale + Library-Loader): `docs/refactor/welle-3-schale-loader/06-acceptance.md`
- Methodik-Strategie: `.cursor/rules/refactor-batch-strategy.mdc`
- Methodik-Lehre `pnpm build`-Pflicht: PR #31 / `AGENTS.md`
- Plan-Datei: `.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md`
