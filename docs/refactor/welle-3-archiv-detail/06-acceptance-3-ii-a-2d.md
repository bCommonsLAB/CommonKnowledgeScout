# Welle 3-II-a Phase 2d — Acceptance (WELLE 3-II-a ABGESCHLOSSEN)

**Branch**: `cursor/refactor-welle-3-ii-a-2d-views-a03a`
**Stand**: 2026-04-30
**PR**: (folgt nach Push)

## Welle-3-II-a Abschluss

Phase 2d ist die letzte Phase von Welle 3-II-a. Nach diesem Merge ist
das Welle-Ziel erreicht: **`PreviewContent` ist auf einen reinen
View-Composer reduziert.**

```tsx
switch (fileType) {
  case 'audio':         return <AudioView {...viewProps} />
  case 'image':         return <ImageView {...viewProps} />
  case 'video':         return <VideoView {...viewProps} />
  case 'markdown':      return <MarkdownView {...viewProps} />
  case 'pdf':           return <PdfView {...viewProps} />
  case 'docx':
  case 'xlsx':
  case 'pptx':          return <OfficeView {...viewProps} />
  case 'presentation':  return <PresentationView {...viewProps} />
  case 'website':       return <WebsiteView {...viewProps} />
  default:              return <DefaultView {...viewProps} />
}
```

## Inhalt Phase 2d (4 Schritte)

| Schritt | Inhalt | Commit | Brutto-Diff |
|---|---|---|---|
| **1/4** | `PreviewViewProps` um 8 markdown-/website-spezifische optionale Felder erweitert | `c889e49` | 49 Zeilen |
| **2/4** | `MarkdownView` ausgliedern (mit Edit-Dialog + 2 Transcript-Tab-Code-Pfaden) | `da4fe7b` | 574 Zeilen |
| **3/4** | `PresentationView` ausgliedern (trivialer DocumentPreview-Wrapper) | `ecba8d0` | 166 Zeilen |
| **4/4** | `WebsiteView` ausgliedern (mit Iframe + 4 Transcript-Tab-Code-Pfaden) | `0d5bace` | 604 Zeilen |
| **Cleanup** | Hook-Order-Fix in MarkdownView + 17 ungenutzte Imports im Mutterfile | `05e06f2` | 99 Zeilen |

| File | Zeilen |
|---|---:|
| `src/components/library/file-preview/views/markdown-view.tsx` | 389 |
| `src/components/library/file-preview/views/presentation-view.tsx` | 34 |
| `src/components/library/file-preview/views/website-view.tsx` | 427 |
| `src/components/library/file-preview/views/view-props.ts` (erweitert) | 153 |
| `tests/unit/components/library/file-preview-markdown-view.test.tsx` | 5 Cases |
| `tests/unit/components/library/file-preview-presentation-view.test.tsx` | 2 Cases |
| `tests/unit/components/library/file-preview-website-view.test.tsx` | 5 Cases |

## Volumen-Statistik

### Phase 2d allein

| Metrik | Vorher (master, 744f728) | Nachher | Differenz |
|---|---:|---:|---:|
| `file-preview.tsx` Zeilen | 1.948 | 1.288 | **-660** |
| Views unter `file-preview/views/` | 1.137 (4 Views) | 2.094 (9 Views) | +957 |
| Test-Files in `file-preview/views/` | 4 | 7 (markdown + presentation + website neu) | +3 |
| Test-Cases View-Tests | 15 | 27 | +12 |

### Welle 3-II-a Gesamt (Phase 1 + 2a + 2b + 2c + 2d)

| Metrik | Welle-Start | Welle-Ende | Differenz |
|---|---:|---:|---:|
| `file-preview.tsx` Zeilen | 4.230 (vor Phase 1) | **1.288** | **-2.942 (-69.5%)** |
| Anzahl ausgegliederte View-Komponenten | 0 | **9** | +9 |
| Anzahl Char-Test-Files unter views/ | 0 | 7 | +7 |
| Test-Cases neu fuer views/ | 0 | 27 | +27 |

**Brutto-Diff Phase 2d vs master**: 8 Files, **+1.403 / -702 (1.692 Zeilen)**.

### Diff-Limit-Diskussion

Brutto-Diff ist ueber dem 1.000-Zeilen-Limit aus AGENT-BRIEF.md.
Das Limit ist explizit auf einzelne **Commits** bezogen — nicht PRs.

**Pro Commit** (alle unter dem 1.000-Zeilen-Limit):

| Commit | Brutto-Zeilen |
|---|---:|
| `Refactor: PreviewViewProps erweitern` | 49 |
| `Refactor: MarkdownView ausgliedern` | 574 |
| `Refactor: PresentationView ausgliedern` | 166 |
| `Refactor: WebsiteView ausgliedern` | 604 |
| `fix: Cleanup` | 99 |

PR-Aufteilung **nicht** notwendig, weil:
1. Alle Commits gehoeren zur selben Welle (3-II-a Abschluss)
2. Bundle-Erweiterung (Schritt 1) und Konsumenten (Schritte 2+4) sind kohaerent
3. Cleanup ist Folge des Inhalts dieser PR

## Bundle-Erweiterung (Schritt 1)

`PreviewViewProps` wurde um 8 neue **optionale** Felder erweitert,
die nur von `MarkdownView` und `WebsiteView` benoetigt werden:

```ts
content?: string
currentFolderId?: string
compositeWikiPreview?: CompositeWikiPreviewOptions | null
isEditOpen?: boolean
setIsEditOpen?: React.Dispatch<React.SetStateAction<boolean>>
contentCache?: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>
onContentUpdated?: (content: string) => void
setSelectedFile?: (item: StorageItem) => void
```

**Begruendung optional**: Audio/Image/Video/PDF/Office Views brauchen sie
NICHT. Optional vermeidet, dass deren Char-Tests Mock-Daten erfinden
muessen. Composer (PreviewContent) setzt sie immer (sie existieren in
der Closure).

## Methodik-DoD

| Kriterium | Status | Belege |
|---|---|---|
| Pro Schritt eigener Commit | OK | 5 Commits (Bundle, MD, Presentation, Website, Cleanup) |
| Char-Tests vorher/zusammen mit Split | OK | 12 neue Test-Cases, alle gruen vor jedem Commit |
| `pnpm test` gruen | OK | 1.066 Tests / 169 Files (17.7s) |
| `pnpm lint` gruen | OK | nur 3 vor-existierende Warnings |
| `pnpm build` gruen | OK | exit 0, kein Error (76s) |
| < 1.000 Zeilen Diff pro Commit | OK | max 604 Zeilen (Website) |
| Keine neuen `any`, keine neuen `catch{}` | OK | Code 1:1 portiert |
| Keine Render-Logik geaendert | OK | Switch-Cases durch View-Komponenten ersetzt |

## Modul-DoD

| Kriterium | Status |
|---|---|
| `PreviewContent`-Switch hat ALLE 9 Cases ausgegliedert (audio, image, video, markdown, pdf, office, presentation, website, default) | OK |
| `PreviewViewProps`-Bundle deckt alle View-Komponenten ab (mit optionalen Erweiterungen) | OK |
| Alle Imports von extrahierten Symbolen im Mutterfile wurden entfernt | OK (verifiziert via `pnpm build`) |
| Char-Tests fuer `MarkdownView` decken Edit-Button ab | OK (5 Cases) |
| Char-Tests fuer `PresentationView` decken Props-Durchreichung ab | OK (2 Cases) |
| Char-Tests fuer `WebsiteView` decken URL-Parsing + Fallback ab | OK (5 Cases) |
| Welle-3-II-a Ziel "PreviewContent ist reiner View-Composer" erreicht | OK |

## Methodik-Lehre PR #31 hat zum 2. Mal funktioniert

Die `pnpm build`-Pflicht aus AGENTS.md hat in diesem PR sogar **2 Bugs**
vor dem Push abgefangen:

1. **react-hooks/rules-of-hooks** Error in `markdown-view.tsx`
   (`useCallback` nach `if (!provider) return`).
2. **17 ungenutzte Imports** in `file-preview.tsx` nach Phase-2d-Splits.

Beide haetten ohne `pnpm build` einen Hotfix-PR gekostet (wie #30 nach
Phase 2a). Diesmal: ein einziger Cleanup-Commit im selben PR.

## Roadmap

Welle 3-II-a ist abgeschlossen. Naechste Schritte gemaess Plan:

- **Welle 3-II-b**: `markdown-preview.tsx` (2.054z) + `markdown-metadata.tsx` (437z) Splits
- **Welle 3-II-c**: `job-report-tab.tsx` (2.284z) + `media-tab.tsx` (1.147z) Splits
- **Welle 3-II-d**: `*-detail.tsx`-Familie + `flow/*` + `shared/*` Splits

Diese sind in `docs/refactor/welle-3-archiv-detail/AGENT-BRIEF.md`
beschrieben.

## Verweise

- Welle 3-II-a Phase 2c Acceptance: `06-acceptance-3-ii-a-2c.md`
- Welle 3-II-a Phase 2b Acceptance: `06-acceptance-3-ii-a-2b.md`
- Welle 3-II-a Phase 2a Acceptance: `06-acceptance-3-ii-a-2.md`
- Welle 3-II-a Phase 1 Acceptance: `06-acceptance-3-ii-a.md`
- Welle 3-II Vorbereitung: `06-acceptance.md`
- Methodik-Lehre `pnpm build`-Pflicht: PR #31 / `AGENTS.md`
- Hotfix-Vorfall: PR #30
