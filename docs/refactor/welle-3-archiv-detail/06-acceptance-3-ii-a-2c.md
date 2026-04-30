# Welle 3-II-a Phase 2c — Acceptance

**Branch**: `cursor/refactor-welle-3-ii-a-2c-views-a03a`
**Stand**: 2026-04-30
**PR**: (folgt nach Push)

## Plan-Anpassung gegenueber AGENT-BRIEF.md

AGENT-BRIEF nannte fuer Phase 2c die Cases **`markdown` + `pdf`**. Bei der
Code-Analyse vor dem Split zeigte sich:

- **`markdown`** braucht 7 zusaetzliche Props, die **nicht** im
  `PreviewViewProps`-Bundle stecken (`content`, `currentFolderId`,
  `compositeWikiPreview`, `isEditOpen`, `setIsEditOpen`, `contentCache`,
  `onContentUpdated`, `setSelectedFile`). Das wuerde eine Bundle-Erweiterung
  erfordern und das Diff unnoetig vergroessern.
- **`pdf`** und **`docx|xlsx|pptx`** sind **strukturell 1:1 zu Video**
  (selbe 5 Tabs, selber PipelineSheet). Beide passen in
  `PreviewViewProps` ohne Aenderung.

**Neuer Plan fuer Phase 2c**: `pdf + office` (statt `markdown + pdf`).
**`markdown` rutscht nach Phase 2d** (zusammen mit der noetigen
Bundle-Erweiterung als eigenes Thema).

Damit bleibt das Risiko in 2c minimal (kein Bundle-Eingriff), und Phase 2d
buendelt die komplexen/heterogenen Cases (markdown + presentation +
website).

## Inhalt

| Case | Neuer File | Zeilen | Test-File | Test-Cases |
|---|---|---|---|---|
| `case 'pdf'` | `src/components/library/file-preview/views/pdf-view.tsx` | 326 | `tests/unit/components/library/file-preview-pdf-view.test.tsx` | 4 |
| `case 'docx'\|'xlsx'\|'pptx'` | `src/components/library/file-preview/views/office-view.tsx` | 331 | `tests/unit/components/library/file-preview-office-view.test.tsx` | 5 |

**Zusaetzliche Aufraeumarbeit** (3. Commit):

- 3 ungenutzte Imports im Mutterfile entfernt
  (`SourceAndTranscriptPane`, `ReviewOriginalPane`,
  `wrapTranscriptTabWithReviewSplit`) — diese wurden nach Phase 2c nur
  noch von ausgegliederten Views genutzt.
- `ReviewTranscriptSplit` und `WebsiteReviewOriginalIframe` BLEIBEN drin
  — werden im `website`-Case (Z. 1367) noch gebraucht.

## Volumen-Statistik

| Metrik | Vorher (master, 852a53f) | Nachher | Differenz |
|---|---:|---:|---:|
| `file-preview.tsx` Zeilen | 2.396 | 1.948 | **-448** |
| Views unter `file-preview/views/` | 1.137 (4 Views) | 1.794 (6 Views) | +657 |
| Test-Files in `file-preview/views/` | 4 | 6 | +2 |
| Test-Cases View-Tests | 15 | 24 | +9 |

**Gesamt-Diff vs master**: 5 Files, **1.014 insertions, 468 deletions
(1.482 Zeilen Brutto-Diff)**.

### Diff-Limit-Diskussion

Brutto-Diff ist **ueber** dem 1.000-Zeilen-Limit aus AGENT-BRIEF.md.
Das Limit ist aber explizit auf **einzelne Commits** bezogen
(*"Stop wenn > 1.000 Zeilen Diff in einem Commit"*) — nicht auf PRs.

Die einzelnen Commits liegen alle unter dem Limit:

| Commit | Brutto-Zeilen |
|---|---:|
| `Refactor: PdfView ausgliedern` | 731 |
| `Refactor: OfficeView ausgliedern` | 741 |
| `fix(file-preview): 3 ungenutzte Imports nach Phase 2c entfernen` | 14 |

PR-Aufteilung **nicht** notwendig, weil:
1. Beide Views sind kohaerent (Tab-Switch-Cleanup pdf + office)
2. Der Hotfix-Commit (Imports) ist Folge des PR-Inhalts
3. Sicherheitsnetz (Char-Tests) ist im selben PR

## Methodik-DoD

| Kriterium | Status | Belege |
|---|---|---|
| Pro Schritt eigener Commit | OK | 3 Commits: PdfView, OfficeView, Imports-Cleanup |
| Char-Tests vorher/zusammen mit Split | OK | 9 neue Test-Cases, 100% gruen vor jedem Commit |
| `pnpm test` gruen | OK | 1.054 Tests / 166 Files (16.96s) |
| `pnpm lint` gruen | OK | nur 3 vor-existierende Warnings in file-preview + 7 ausserhalb Welle 3 |
| `pnpm build` gruen | OK | exit 0, kein Error |
| < 1.000 Zeilen Diff pro Commit | OK | max 741 Zeilen Brutto pro Commit |
| Keine neuen `any`, keine neuen `catch{}` | OK | Code 1:1 portiert |
| Keine Render-Logik geaendert | OK | Switch-Cases durch View-Komponenten ersetzt |

## Modul-DoD

| Kriterium | Status |
|---|---|
| `PreviewContent`-Switch hat 6 Cases ausgegliedert (audio, image, video, default, pdf, office) | OK |
| `PreviewViewProps`-Bundle wird unveraendert wiederverwendet (kein Bundle-Eingriff) | OK |
| Imports von extrahierten Symbolen im Mutterfile sind alle noch genutzt | OK (verifiziert via `pnpm build`) |
| Char-Tests fuer `PdfView` decken die wichtigsten Render-Pfade ab | OK (4 Cases) |
| Char-Tests fuer `OfficeView` decken docx/xlsx/pptx ab | OK (5 Cases) |
| Office-Eigenheiten (kind hardcoded, kuerzerer Story-Hint, ohne headerExtra) sind als Code-Kommentare dokumentiert | OK |

## Methodik-Lehre angewendet (PR #31)

Die `pnpm build`-Pflicht aus AGENTS.md hat den Bug **vor dem Push**
abgefangen. Konkreter Ablauf:

1. PdfView + OfficeView ausgegliedert, Char-Tests gruen.
2. `pnpm build` gestartet — Build **rot** mit
   `@typescript-eslint/no-unused-vars` fuer 3 Imports.
3. Imports im Mutterfile entfernt (3. Commit).
4. `pnpm build` erneut — **gruen**.

**Vergleich zu Phase 2a (vor PR #31)**: Damals ist genau dieser Bug
durch den Push gerutscht und hat einen Hotfix-PR (#30) erfordert. PR #31
hat das gefixt — die Methodik funktioniert.

## Restliche Cases nach Phase 2c

| Case | Geschaetzte Zeilen | Komplexitaet | Phase |
|---|---:|---|---|
| `markdown` | ~287 | hoch (Bundle-Erweiterung noetig) | 2d |
| `presentation` | ~8 | trivial (1-Liner) | 2d |
| `website` | ~360 | mittel (eigener Switch im Switch) | 2d |

**Phase 2d** wird also: Bundle-Erweiterung um markdown-spezifische Felder
(`content`, `currentFolderId`, `compositeWikiPreview`, edit-handlers) +
Ausgliederung der 3 verbleibenden Cases. Geschaetzt ~1.500 Brutto-Diff,
aufteilbar in 3 Commits unter 700 Zeilen.

Nach Phase 2d ist **`PreviewContent`-Switch reduziert auf einen reinen
View-Composer** — Ziel von Welle 3-II-a erreicht.

## Verweise

- Welle 3-II-a Phase 2b Acceptance: `06-acceptance-3-ii-a-2b.md`
- Welle 3-II-a Phase 2a Acceptance: `06-acceptance-3-ii-a-2.md`
- Welle 3-II-a Phase 1 Acceptance: `06-acceptance-3-ii-a.md`
- Methodik-Lehre `pnpm build`-Pflicht: PR #31 / `AGENTS.md`
- Hotfix-Vorfall: PR #30
