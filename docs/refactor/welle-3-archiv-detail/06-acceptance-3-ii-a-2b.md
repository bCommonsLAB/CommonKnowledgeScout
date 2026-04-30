# Welle 3-II-a Phase 2b — Acceptance

**Branch**: `cursor/refactor-welle-3-ii-a-2b-views-a03a`
**Stand**: 2026-04-30
**PR**: (folgt nach Push)

## Inhalt

Phase 2b setzt den View-Split aus Phase 2a fort und gliedert die zwei
**verbleibenden einfachen Cases** des `PreviewContent`-Switches aus:

| Case | Neuer File | Zeilen | Test-File | Test-Cases |
|---|---|---|---|---|
| `case 'video'` | `src/components/library/file-preview/views/video-view.tsx` | 333 | `tests/unit/components/library/file-preview-video-view.test.tsx` | 4 |
| `default:` | `src/components/library/file-preview/views/default-view.tsx` | 91 | `tests/unit/components/library/file-preview-default-view.test.tsx` | 3 |

**Nicht in dieser PR** (Phase 2c/2d):

- `case 'markdown'` (~290 Zeilen) — komplex, eigener PR
- `case 'pdf'` (~234 Zeilen) — komplex, eigener PR
- `case 'docx' | 'xlsx' | 'pptx'` (~218 Zeilen) — Office, eigener PR
- `case 'presentation'` + `case 'website'` (~360 Zeilen) — eigener PR

## Volumen-Statistik

| Metrik | Vorher (master, 7cca41b) | Nachher | Differenz |
|---|---:|---:|---:|
| `file-preview.tsx` Zeilen | 2.658 | 2.396 | **-262** |
| Views unter `file-preview/views/` | 651 (audio + image + view-props) | 1.137 (+ video + default) | +486 |
| Test-Files in `file-preview/views/` | 2 (audio, image) | 4 (audio, image, video, default) | +2 |
| Test-Cases View-Tests | 8 | 15 | +7 |

**Gesamt-Diff vs master**: 5 Files, 713 insertions, 274 deletions
(987 Zeilen Brutto-Diff — exakt im 1.000-Zeilen-Limit aus AGENT-BRIEF.md).

## Methodik-DoD

| Kriterium | Status | Belege |
|---|---|---|
| Pro Schritt eigener Commit | OK | 2 Commits: `Refactor: VideoView ausgliedern`, `Refactor: DefaultView ausgliedern` |
| Char-Tests vorher/zusammen mit Split | OK | 7 neue Test-Cases, 100% gruen vor jedem Commit |
| `pnpm test` gruen | OK | 1.044 Tests / 164 Files (15.89s) |
| `pnpm lint` gruen | OK | nur 7 vor-existierende Warnings ausserhalb Welle 3 |
| `pnpm build` gruen | OK | 80s, kein Error (PFLICHT seit AGENTS.md-Update PR #31) |
| < 1.000 Zeilen Diff | OK | 987 Zeilen |
| Keine neuen `any`, keine neuen `catch{}` | OK | Code 1:1 portiert + zusatzlich Komponenten-Doku |
| Keine Render-Logik geaendert | OK | Switch-Case durch View-Komponente ersetzt, sonst byte-identisch |

## Modul-DoD

| Kriterium | Status |
|---|---|
| `PreviewContent`-Switch hat 4 Cases ausgegliedert (audio, image, video, default) | OK |
| `PreviewViewProps`-Bundle wird unveraendert wiederverwendet (keine neuen Props) | OK |
| Imports von extrahierten Symbolen im Mutterfile sind alle noch genutzt | OK (verifiziert via `pnpm build`) |
| Char-Tests fuer `VideoView` decken die wichtigsten Render-Pfade ab | OK (4 Cases: provider=null, 5 Tabs, Source-Pane, JobProgressBar) |
| Char-Tests fuer `DefaultView` decken Fallback-Pfad ab | OK (3 Cases: Hinweis, PipelineSheet, provider=null) |

## Lehre aus PR #29 / Hotfix #30 angewendet

`pnpm build` wurde **vor** dem Push lokal ausgefuehrt (siehe PR #31).
Verifiziert: 80s, kein Error. Insbesondere kein
`@typescript-eslint/no-unused-vars`-Issue, weil:

- Ich habe NICHT versucht, `Tabs`/`TabsContent`/`Alert`-Imports im
  Mutterfile zu entfernen — sie werden weiter von den anderen 6
  noch nicht ausgegliederten Cases (markdown, pdf, office, presentation,
  website) verwendet.
- VideoView ist 1:1 zu AudioView strukturiert, daher keine neuen
  Mock-Patterns noetig.

## Naechste Schritte

- Phase 2c: `markdown` + `pdf` Cases (zwei separate Commits, ~520 Zeilen
  Brutto-Diff)
- Phase 2d: `office` + `presentation` + `website` (zwei separate Commits,
  ~580 Zeilen Brutto-Diff)
- Nach Phase 2d ist `PreviewContent` reduziert auf einen reinen
  Switch-Composer — Ziel von Welle 3-II-a erreicht.

## Verweise

- Welle 3-II-a Phase 2a Acceptance: `06-acceptance-3-ii-a-2.md`
- Welle 3-II-a Phase 1 Acceptance: `06-acceptance-3-ii-a.md`
- AGENT-BRIEF: `AGENT-BRIEF.md`
- Contracts: `.cursor/rules/welle-3-archiv-detail-contracts.mdc` §6
- Lehre `pnpm build`-Pflicht: `AGENTS.md` (seit PR #31)
