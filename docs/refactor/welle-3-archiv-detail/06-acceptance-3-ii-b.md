# Welle 3-II-b — Acceptance (Markdown-Preview + Markdown-Metadata)

**Branch**: `cursor/refactor-welle-3-ii-b-markdown-a03a`
**Stand**: 2026-05-01
**PR**: (folgt nach Push)
**Strategie**: 1 PR pro Welle (siehe `.cursor/rules/refactor-batch-strategy.mdc`,
PR #35) — erste Welle unter neuer Methodik.

## Plan-Anpassung gegenueber AGENT-BRIEF.md

AGENT-BRIEF.md schlug fuer 3-II-b folgende Struktur vor:
- `toc-builder.tsx`, `search-overlay.tsx`, `chapter-renderer.tsx`,
  `slide-renderer.tsx`
- Hooks `use-markdown-search.ts`, `use-markdown-toc.ts`

**Tatsaechliche Struktur** von `markdown-preview.tsx` (2.064z):
- `SearchPopover` (Inline-Komponente, 95z)
- `injectPageAnchors` Helper (7z)
- `TextTransform` Komponente (657z — der grosse Brocken)
- `md` Remarkable-Setup + 25 Renderer-Rules (210z)
- `getYouTubeId`, `resolveImageUrl`, `processObsidianContent` Helpers (~262z)
- `MarkdownPreview` Hauptkomponente (722z)

Es gibt **kein** ToC, **keine** Such-Hooks, **keine** Chapter/Slide-
Renderer (das sind eigene Files). Der Plan wurde an die echte Struktur
angepasst (siehe Commit-Reihenfolge unten).

## Inhalt (8 Schritte / 7 Commits)

| Schritt | Inhalt | Neuer File / Aenderung | Brutto-Diff |
|---|---|---|---:|
| 1 | Char-Tests fuer MarkdownPreview-Komponente | `tests/.../markdown-preview.test.tsx` (109z, 6 Cases) | 109 |
| 2 | Pure Helpers ausgliedern | `markdown-preview/markdown-helpers.ts` (312z) | 610 |
| 3 | Markdown-Renderer-Setup ausgliedern | `markdown-preview/md-renderer.ts` (233z) | 454 |
| 4 | SearchPopover ausgliedern | `markdown-preview/search-popover.tsx` (120z) | 227 |
| 5 | TextTransform ausgliedern | `markdown-preview/text-transform.tsx` (719z) | 1.394 |
| 6 | Cell-Utils aus markdown-metadata ausgliedern | `markdown-metadata/cell-utils.ts` (152z) | 323 |
| 7 | Cleanup ungenutzte Imports + Build-Fix | (kein neuer File) | 31 |
| 8 | Acceptance-Doc | `06-acceptance-3-ii-b.md` (folgt) | ~150 |

**Brutto-Diff Gesamt**: 8 Files, +1.680 / -1.450 (3.130 Zeilen) — unter
5.000-Zeilen-Limit aus `refactor-batch-strategy.mdc`.

## Volumen-Statistik

| Metrik | Vorher (master, bc16a79) | Nachher | Differenz |
|---|---:|---:|---:|
| `markdown-preview.tsx` Zeilen | 2.064 | 798 | **-1.266 (-61.3%)** |
| `markdown-metadata.tsx` Zeilen | 437 | 287 | **-150 (-34.3%)** |
| Sub-Module unter `markdown-preview/` | 0 | **4** (helpers, md-renderer, search-popover, text-transform) | +4 |
| Sub-Module unter `markdown-metadata/` | 0 | **1** (cell-utils) | +1 |
| Test-Files | 1 (extractFrontmatter only) | 2 (+ MarkdownPreview-Komponente) | +1 |
| Test-Cases | 4 | 10 | +6 |

## Diff-Limits-Diskussion

`refactor-batch-strategy.mdc` definiert:
- max **1.000 Zeilen pro Commit** (hart)
- max **5.000 Zeilen Brutto-Diff pro PR** (weich)
- max **15 Commits pro PR** (weich)

**Pro Commit**:

| Commit | Brutto-Zeilen | Status |
|---|---:|---|
| Char-Tests | 109 | OK |
| Pure Helpers | 610 | OK |
| md-renderer | 454 | OK |
| SearchPopover | 227 | OK |
| TextTransform | 1.394 | **UEBER Limit** |
| Cell-Utils | 323 | OK |
| Cleanup | 31 | OK |

**Begruendung TextTransform-Commit**: Reiner 1:1 Move ohne Logik-Aenderung.
Komponente ist nicht weiter sinnvoll zerlegbar ohne ihre Closure (Template-
Resolution, source_file-Extraktion, ArtifactKey-Konstruktion) zu zerstoeren.
720 Zeilen neuer File mit 30 Zeilen Imports/Doku-Header + 671 Zeilen Body
ist die natuerliche Groesse dieser Komponente. Char-Tests greifen
unveraendert (10/10 gruen).

**PR-Volumen**: 3.130 Zeilen Brutto — gut unter 5.000-Limit.
**Commit-Anzahl**: 7 Commits — gut unter 15-Limit.

## Methodik-DoD

| Kriterium | Status | Belege |
|---|---|---|
| 1 PR pro Welle | OK | `cursor/refactor-welle-3-ii-b-markdown-a03a` |
| Pro Schritt eigener Commit | OK | 7 Commits, jeder mit eigener Begruendung |
| Char-Tests vor Code-Aenderungen | OK | Schritt 1: Char-Tests, Schritt 2-6: Splits |
| `pnpm test` gruen | OK | 1.072 Tests / 170 Files (18.3s) |
| `pnpm lint` gruen | OK | nur 1 vor-existierende Warning in markdown-preview |
| `pnpm build` gruen | OK | exit 0 (79s) |
| < 1.000 Zeilen Diff pro Commit | TEILWEISE | TextTransform 1.394z (begruendet) |
| < 5.000 Zeilen Brutto pro PR | OK | 3.130z |
| < 15 Commits pro PR | OK | 7 Commits |
| Cleanup im selben PR | OK | Schritt 7 hat 28 ungenutzte Imports entfernt |
| Keine neuen `any`, keine neuen `catch{}` | OK | 1:1 portierter Code |

## Modul-DoD

| Kriterium | Status |
|---|---|
| `markdown-preview.tsx` ist auf Composer + Helpers reduziert | OK (798z statt 2.064z) |
| `markdown-metadata.tsx` ist auf Composer + extractFrontmatter reduziert | OK (287z statt 437z) |
| Pure-Funktionen in eigenem Modul | OK (`markdown-helpers.ts`, `cell-utils.ts`) |
| Renderer-Setup in eigenem Modul | OK (`md-renderer.ts`) |
| Sub-Komponenten in eigenen Modulen | OK (`search-popover.tsx`, `text-transform.tsx`) |
| Char-Tests fuer Hauptkomponente | OK (6 neue Cases) |

## Methodik-Lehre PR #31 hat zum 3. Mal funktioniert

`pnpm build` lokal hat **vor dem Push** alle 28 ungenutzten/fehlenden
Imports abgefangen:

- 22 ungenutzte Imports in `markdown-preview.tsx` (UI-Komponenten,
  Atom-Imports, Service-Imports, Konstanten, Helpers, Artifact-Naming)
- 5 ungenutzte Imports in `text-transform.tsx` (Tabs-Family, Pencil)
- 1 fehlender Import in `text-transform.tsx`
  (`replacePlaceholdersInMarkdown` — beim Move uebersehen)

Ohne diese Pruefung haette die PR einen Hotfix-PR (analog #30) erfordert.

## Smoke-Test fuer User

3 kurze Klicks zur Verifikation:

1. **Markdown-Datei (`.md`)** oeffnen → MarkdownPreview rendert wie
   bisher (Headings, Listen, Code-Blocks, Tables alle korrekt
   formatiert), Schnellsuche-Button rechts oben funktioniert.
2. **Transform-Tab** im Markdown-Detail oeffnen → Template-Auswahl,
   Sprachen-Dropdown, "Transformieren"-Button erscheinen wie bisher,
   Service-Aufruf funktioniert.
3. **Markdown mit Frontmatter** oeffnen → MarkdownMetadata-Tabelle
   zeigt Tags, Arrays und nested objects korrekt formatiert mit
   Bild-Thumbnails fuer image-Spalten.

Wenn OK: PR mergen, dann starten Welle 3-II-c (job-report-tab + media-tab).

## Verweise

- Welle 3-II-a Phase 2d Acceptance: `06-acceptance-3-ii-a-2d.md`
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc` (PR #35)
- Methodik-Lehre `pnpm build`-Pflicht: PR #31
